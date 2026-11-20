#!/usr/bin/env python3
"""reembed-local.py — re-embed the SEC 10-K corpus ON THE KIT.

The committed sec_10k_2026 corpus carries 1536-d vectors from an earlier
connected build. The airgapped kit embeds with Jina Embeddings v5 Omni on the
DGX Spark, so this script re-embeds each chunk's `text` and writes a new
bulk-NDJSON whose `emb` dims match the index built by setup-index-local.sh.

Backends (both local to the kit):
  jina   (default)  POST {--jina}/v1/embeddings {"model", "input": [...], "dimensions"}
                    Jina Embeddings v5 Omni on :8081. Reads data[i].embedding.
  ollama (fallback) POST {--ollama}/api/embed {"model", "input": [...]}

The query path (demo/backend/app/services/embedder.py, EMBED_BACKEND=jina) uses
the SAME endpoint, model and dims with raw text, so document and query vectors
live in one space. --dims must equal the backend's SEC_EMBED_DIMS
(demo/backend/app/config.py); run-all.sh reads it from there.

Input  : a bulk-NDJSON (alternating {"index":{}} / doc lines) with a `text`
         field. The existing `emb` field, if present, is dropped and replaced.
Output : a bulk-NDJSON ready for ES /_bulk.

Usage:
  python3 reembed-local.py \
      --src   /data/sec/sec_10k_bulk.ndjson \
      --out   ./sec_10k_local.ndjson \
      --backend jina --jina http://192.168.1.20:8081 \
      --model jina-embeddings-v5-omni-small --dims 768 \
      --batch 64
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
import urllib.error
import urllib.request


MAX_CHARS = 8000  # cap per chunk so an over-long doc can't 400/overflow the model


def _sanitize(text: str) -> str:
    """Non-empty, length-capped text. Empty/whitespace → '' (caller skips)."""
    t = (text or "").strip()
    return t[:MAX_CHARS]


def _post_embed(cfg: dict, texts: list[str], retries: int = 4):
    """One embed call (Jina /v1/embeddings or Ollama /api/embed) with retries."""
    if cfg["backend"] == "jina":
        url = f"{cfg['jina'].rstrip('/')}/v1/embeddings"
        payload = {"model": cfg["model"], "input": texts}
        if cfg["dims"]:
            payload["dimensions"] = cfg["dims"]
    else:
        url = f"{cfg['ollama'].rstrip('/')}/api/embed"
        payload = {"model": cfg["model"], "input": texts}
    body = json.dumps(payload).encode()
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, method="POST",
                                         headers={"Content-Type": "application/json"})
            resp = json.loads(urllib.request.urlopen(req, timeout=300).read())
            if cfg["backend"] == "jina":
                data = sorted(resp.get("data") or [], key=lambda d: d.get("index", 0))
                embs = [d["embedding"] for d in data]
            else:
                embs = resp.get("embeddings")
            if not embs or len(embs) != len(texts):
                raise RuntimeError(f"expected {len(texts)} embeddings, got {len(embs) if embs else 0}")
            return embs
        except urllib.error.HTTPError as e:
            # 400 = malformed/over-long input; retrying the same batch won't help
            if e.code == 400:
                raise
            last = e
        except Exception as e:  # noqa: BLE001 — transient transport/model hiccup
            last = e
        wait = min(20, 2 ** attempt)
        print(f"  batch err ({last!r}); retry in {wait}s", file=sys.stderr)
        time.sleep(wait)
    raise RuntimeError(f"batch failed after {retries} retries ({last!r})")


def embed_batch(cfg: dict, texts: list[str]) -> list:
    """Embed a batch, returning one vector per input. On a batch-level failure,
    recursively split so a single bad chunk is isolated and skipped (→ None)
    instead of aborting the whole corpus."""
    try:
        return _post_embed(cfg, texts)
    except Exception as e:  # noqa: BLE001
        if len(texts) == 1:
            print(f"  SKIP unembeddable chunk (len={len(texts[0])}): {e!r}", file=sys.stderr)
            return [None]
        mid = len(texts) // 2
        return (embed_batch(cfg, texts[:mid])
                + embed_batch(cfg, texts[mid:]))


def iter_docs(src: str):
    """Yield doc dicts from a bulk-NDJSON (plain or .gz), skipping action lines."""
    opener = gzip.open if src.endswith(".gz") else open
    with opener(src, "rt", errors="replace") as f:
        while True:
            action = f.readline()
            if not action:
                return
            doc_line = f.readline()
            if not doc_line:
                return
            line = doc_line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="source bulk-NDJSON (previously embedded or text-only)")
    ap.add_argument("--out", default="./sec_10k_local.ndjson")
    ap.add_argument("--backend", choices=["jina", "ollama"], default="jina")
    ap.add_argument("--jina", default="http://192.168.1.20:8081", help="Jina v5 Omni server on the Spark")
    ap.add_argument("--ollama", default="http://192.168.1.20:11434", help="Ollama on the Spark (fallback backend)")
    ap.add_argument("--model", default=None,
                    help="default: jina-embeddings-v5-omni-small (jina) / nomic-embed-text (ollama)")
    ap.add_argument("--dims", type=int, default=768,
                    help="vector dims; must equal SEC_EMBED_DIMS in demo/backend/app/config.py")
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--max-docs", type=int, default=None)
    args = ap.parse_args()
    model = args.model or ("jina-embeddings-v5-omni-small" if args.backend == "jina" else "nomic-embed-text")
    cfg = {"backend": args.backend, "jina": args.jina, "ollama": args.ollama,
           "model": model, "dims": args.dims}
    print(f"  backend={args.backend} model={model} dims={args.dims}")

    n = 0
    dims = None
    t0 = time.time()
    pending_docs: list[dict] = []

    skipped = [0]

    def flush(out_f, batch: list[dict]) -> None:
        nonlocal n, dims
        if not batch:
            return
        # sanitize + drop empty-text docs before embedding
        clean = [(d, _sanitize(d.get("text", ""))) for d in batch]
        clean = [(d, t) for d, t in clean if t]
        skipped[0] += len(batch) - len(clean)
        if not clean:
            return
        vecs = embed_batch(cfg, [t for _, t in clean])
        for (doc, _), vec in zip(clean, vecs):
            if vec is None:           # isolated unembeddable chunk — skip
                skipped[0] += 1
                continue
            if dims is None:
                dims = len(vec)
                print(f"  embedding dims = {dims}")
                if args.dims and dims != args.dims:
                    raise SystemExit(f"embedder returned {dims}-d, expected --dims {args.dims}; "
                                     "fix the server or the dims before indexing")
            doc = {k: v for k, v in doc.items() if k != "emb"}
            doc["emb"] = vec
            out_f.write(json.dumps({"index": {}}) + "\n")
            out_f.write(json.dumps(doc) + "\n")
            n += 1

    with open(args.out, "w") as out_f:
        for doc in iter_docs(args.src):
            if "text" not in doc:
                continue
            pending_docs.append(doc)
            if len(pending_docs) >= args.batch:
                flush(out_f, pending_docs)
                pending_docs = []
                if n % 2000 == 0:
                    rate = n / (time.time() - t0)
                    print(f"  chunks={n:>6}  rate={rate:.1f}/s")
                if args.max_docs and n >= args.max_docs:
                    break
        if not (args.max_docs and n >= args.max_docs):
            flush(out_f, pending_docs)

    elapsed = time.time() - t0
    print(f"done: {n} chunks → {args.out} ({dims}-d) in {elapsed:.0f}s  [skipped {skipped[0]}]")
    print(f"next: DIMS={dims} bash setup-index-local.sh {args.out}")


if __name__ == "__main__":
    main()
