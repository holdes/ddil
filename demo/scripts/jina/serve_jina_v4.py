#!/usr/bin/env python3
"""serve_jina_v4.py — OpenAI-compatible embeddings server backed by
jina-embeddings-v4 (multimodal: text + image in one space).

Airgapped replacement for the jina omni-small server the demo expects on :8081.
Implements exactly the contract the kit's scripts/ES use:

  POST /v1/embeddings
    {"input": [<str> | {"type":"image_base64","image_base64":{"base64":..,"mime_type":..}}, ...],
     "model": "...", "dimensions": 768|1024 (optional)}
  -> {"object":"list","data":[{"object":"embedding","index":i,"embedding":[...]}], ...}

Dims: default 1024 (pmc-unstructured); callers that need 768 (jina-multimodal +
the ES text_embedding inference endpoint) pass "dimensions": 768. v4 is native
2048-d; we Matryoshka-truncate then L2-normalize (indices use cosine).

Run (in the jina-embed conda env):
  JINA_MODEL_ID=jinaai/jina-embeddings-v4 \
  ~/miniforge3/envs/jina-embed/bin/python serve_jina_v4.py --host 0.0.0.0 --port 8081
"""
from __future__ import annotations

import argparse
import base64
import io
import os
from typing import Any, List, Optional, Union

import torch
import torch.nn.functional as F
from fastapi import FastAPI
from PIL import Image
from pydantic import BaseModel
from transformers import AutoModel

MODEL_ID = os.environ.get("JINA_MODEL_ID", "jinaai/jina-embeddings-v4")
DEFAULT_DIM = int(os.environ.get("JINA_DEFAULT_DIM", "1024"))
TASK = os.environ.get("JINA_TASK", "retrieval")
TEXT_PROMPT = os.environ.get("JINA_TEXT_PROMPT", "passage")  # v4 retrieval: query|passage
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

print(f"[jina] loading {MODEL_ID} on {DEVICE} ({DTYPE}) ...", flush=True)
model = AutoModel.from_pretrained(MODEL_ID, trust_remote_code=True, torch_dtype=DTYPE)
model.to(DEVICE).eval()
print("[jina] model ready", flush=True)

app = FastAPI(title="jina-v4-embeddings")


class EmbReq(BaseModel):
    input: List[Any]
    model: Optional[str] = None
    dimensions: Optional[int] = None


def _vec(x: Any, dim: int) -> List[float]:
    t = x if isinstance(x, torch.Tensor) else torch.as_tensor(x)
    t = t.float().flatten()
    if t.numel() > dim:          # Matryoshka truncate, then renormalize
        t = t[:dim]
    t = F.normalize(t, dim=-1)
    return t.cpu().tolist()


# jina-v4 only accepts these Matryoshka truncate_dims natively. For any other
# requested dim (e.g. 768 for jina-multimodal), ask the model for the smallest
# valid dim >= requested, then truncate+renormalize to the exact dim in _vec().
MODEL_DIMS = [128, 256, 512, 1024, 2048]


def _model_dim(dim: int) -> int:
    for d in MODEL_DIMS:
        if d >= dim:
            return d
    return MODEL_DIMS[-1]


@torch.inference_mode()
def _embed_texts(texts: List[str], dim: int) -> List[List[float]]:
    out = model.encode_text(texts=texts, task=TASK, prompt_name=TEXT_PROMPT, truncate_dim=_model_dim(dim))
    return [_vec(e, dim) for e in out]


MIN_PX = 28  # Qwen2-VL image processor requires both sides >= 28 ("factor")


@torch.inference_mode()
def _embed_image(img: Image.Image, dim: int) -> List[float]:
    # tiny sub-figure crops (e.g. 21x31) crash the Qwen2-VL preprocessor; upscale
    # so they embed instead of 500ing.
    if img.width < MIN_PX or img.height < MIN_PX:
        s = max(MIN_PX / img.width, MIN_PX / img.height)
        img = img.resize((max(MIN_PX, round(img.width * s)),
                          max(MIN_PX, round(img.height * s))), Image.BICUBIC)
    out = model.encode_image(images=[img], task=TASK, truncate_dim=_model_dim(dim))
    return _vec(out[0], dim)


@app.post("/v1/embeddings")
def embeddings(req: EmbReq):
    dim = req.dimensions or DEFAULT_DIM
    results: List[Optional[List[float]]] = [None] * len(req.input)

    # Batch the plain-text items; handle images one at a time (order preserved).
    texts: List[str] = []
    text_pos: List[int] = []
    for i, item in enumerate(req.input):
        if isinstance(item, str):
            texts.append(item)
            text_pos.append(i)
        elif isinstance(item, dict) and item.get("type") == "image_base64":
            b64 = item["image_base64"]["base64"]
            img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
            results[i] = _embed_image(img, dim)
        else:
            texts.append(str(item))
            text_pos.append(i)

    if texts:
        for pos, vec in zip(text_pos, _embed_texts(texts, dim)):
            results[pos] = vec

    data = [{"object": "embedding", "index": i, "embedding": v} for i, v in enumerate(results)]
    return {"object": "list", "data": data, "model": req.model or MODEL_ID,
            "usage": {"prompt_tokens": 0, "total_tokens": 0}}


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID, "default_dim": DEFAULT_DIM, "device": DEVICE}


if __name__ == "__main__":
    import uvicorn
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8081)
    args = ap.parse_args()
    uvicorn.run(app, host=args.host, port=args.port)
