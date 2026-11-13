#!/usr/bin/env python3
"""reembed-local.py — re-embed the SEC 10-K corpus with a LOCAL Ollama model.

The bench corpus (bench-aws/finance/sec_10k_bulk.ndjson) was embedded with
Bedrock Cohere Embed v4 (1536-d). For the airgapped kit there is no Bedrock, so
this re-embeds each chunk's `text` with the kit's local embedder
(nomic-embed-text, 768-d by default) and writes a new bulk-NDJSON whose `emb`
dims match the airgapped index built by setup-index-local.sh.

The query path (demo/backend/app/routers/finance.py with EMBED_BACKEND=ollama)
uses the SAME model/endpoint with raw text — no task prefix on either side —
so document and query vectors live in one space.

Input  : a bulk-NDJSON (alternating {"index":{}} / doc lines) with a `text`
         field. The existing `emb` field, if present, is dropped and replaced.
Output : a bulk-NDJSON ready for ES /_bulk.

Usage:
  python3 reembed-local.py \
      --src   /path/to/sec_10k_bulk.ndjson \
      --out   ./sec_10k_local.ndjson \
      --ollama http://192.168.1.20:11434 \
      --model nomic-embed-text \
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


def _post_embed(ollama: str, model: str, texts: list[str], retries: int = 4):
    """One Ollama /api/embed call with retries. Returns embeddings or raises."""
    body = json.dumps({"model": model, "input": texts}).encode()
    url = f"{ollama.rstrip('/')}/api/embed"
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, method="POST",
                                         headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=300).read()
            embs = json.loads(resp).get("embeddings")
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


def embed_batch(ollama: str, model: str, texts: list[str]) -> list:
    """Embed a batch, returning one vector per input. On a batch-level failure,
    recursively split so a single bad chunk is isolated and skipped (→ None)
    instead of aborting the whole corpus."""
    try:
        return _post_embed(ollama, model, texts)
    except Exception as e:  # noqa: BLE001
        if len(texts) == 1:
            print(f"  SKIP unembeddable chunk (len={len(texts[0])}): {e!r}", file=sys.stderr)
            return [None]
        mid = len(texts) // 2
        return (embed_batch(ollama, model, texts[:mid])
                + embed_batch(ollama, model, texts[mid:]))


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
    ap.add_argument("--src", required=True, help="source bulk-NDJSON (Cohere-embedded or text-only)")
    ap.add_argument("--out", default="./sec_10k_local.ndjson")
    ap.add_argument("--ollama", default="http://192.168.1.20:11434")
    ap.add_argument("--model", default="nomic-embed-text")
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--max-docs", type=int, default=None)
    args = ap.parse_args()

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
        vecs = embed_batch(args.ollama, args.model, [t for _, t in clean])
        for (doc, _), vec in zip(clean, vecs):
            if vec is None:           # isolated unembeddable chunk — skip
                skipped[0] += 1
                continue
            if dims is None:
                dims = len(vec)
                print(f"  embedding dims = {dims}")
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
