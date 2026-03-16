#!/usr/bin/env python3
"""Pre-compute image embeddings for grape disease images.

Supports two modes:
  --mode pytorch  : Use jina-embeddings-v4 via HuggingFace Transformers (real image embeddings)
  --mode ollama   : Use Ollama text embedding of image descriptions (fallback)

Usage:
  # Real image embeddings (requires PyTorch + transformers in ~/inference-env):
  source ~/inference-env/bin/activate
  python embed-images.py --mode pytorch

  # Fallback text-description embeddings:
  python embed-images.py --mode ollama --ollama-url http://localhost:11434
"""

import argparse
import json
import sys
import time
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".JPG", ".JPEG", ".PNG"}


def load_pytorch_model(model_name: str, device: str):
    """Load Jina v4 multimodal model via HuggingFace Transformers."""
    try:
        import torch
        from transformers import AutoModel
    except ImportError:
        print("PyTorch mode requires: pip install torch torchvision transformers pillow peft")
        sys.exit(1)

    print(f"Loading {model_name} on {device}...")
    model = AutoModel.from_pretrained(
        model_name,
        trust_remote_code=True,
        dtype=torch.float16 if device == "cuda" else torch.float32,
    )
    if device == "cuda":
        model = model.to(device)
    model.eval()
    print(f"Model loaded ({sum(p.numel() for p in model.parameters()) / 1e9:.1f}B params)")
    return model


def embed_images_pytorch(image_paths: list, model, batch_size: int = 16) -> list:
    """Embed a batch of images using Jina v4 PyTorch model."""
    import torch
    str_paths = [str(p) for p in image_paths]
    embeddings = model.encode_image(images=str_paths, task="retrieval")
    # Handle various return types: list of tensors, tensor, or list of lists
    result = []
    if isinstance(embeddings, list):
        for e in embeddings:
            if hasattr(e, "cpu"):
                result.append(e.cpu().float().tolist())
            else:
                result.append(e)
    elif hasattr(embeddings, "cpu"):
        result = embeddings.cpu().float().tolist()
    else:
        result = embeddings
    return result


def embed_images_ollama(descriptions: list, ollama_url: str, model: str) -> list:
    """Embed text descriptions via Ollama (fallback mode)."""
    import httpx
    embeddings = []
    with httpx.Client(timeout=60) as client:
        for desc in descriptions:
            resp = client.post(
                f"{ollama_url}/api/embed",
                json={"model": model, "input": desc},
            )
            resp.raise_for_status()
            embeddings.append(resp.json()["embeddings"][0])
    return embeddings


def classify_from_path(img_path: Path) -> str:
    """Derive disease classification from directory structure."""
    parent = img_path.parent.name.lower()
    if "black_rot" in parent or "blackrot" in parent:
        return "Black Rot"
    elif "esca" in parent or "black_measles" in parent:
        return "Esca (Black Measles)"
    elif "leaf_blight" in parent or "isariopsis" in parent:
        return "Leaf Blight"
    elif "healthy" in parent:
        return "Healthy"
    else:
        return parent.replace("_", " ").title()


def collect_images(input_dirs: list) -> list:
    """Collect all image paths from input directories."""
    images = []
    for input_dir in input_dirs:
        input_dir = Path(input_dir)
        if not input_dir.exists():
            print(f"  Skipping {input_dir} (not found)")
            continue
        for f in sorted(input_dir.rglob("*")):
            if f.suffix in IMAGE_EXTENSIONS and f.is_file():
                images.append(f)
    return images


def main():
    parser = argparse.ArgumentParser(description="Pre-compute image embeddings for grape disease images")
    parser.add_argument(
        "--input", nargs="+", type=Path,
        default=[
            Path(__file__).parent.parent / "data" / "raw" / "grape-disease",
            Path(__file__).parent.parent / "data" / "raw" / "plantvillage-grape",
        ],
    )
    parser.add_argument(
        "--output", type=Path,
        default=Path(__file__).parent.parent / "data" / "preprocessed" / "grape-embeddings.jsonl",
    )
    parser.add_argument("--mode", choices=["pytorch", "ollama"], default="pytorch")
    parser.add_argument("--model", default="jinaai/jina-embeddings-v4",
                        help="HF model name (pytorch mode) or Ollama model name (ollama mode)")
    parser.add_argument("--ollama-url", default="http://localhost:11434")
    parser.add_argument("--ollama-model", default="hf.co/jinaai/jina-embeddings-v4-text-retrieval-GGUF:Q8_0")
    parser.add_argument("--device", default="cuda", help="cuda or cpu (pytorch mode)")
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--no-resume", action="store_true")
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)

    # Collect images
    all_images = collect_images(args.input)
    print(f"Found {len(all_images)} total images")

    # Resume support
    processed = set()
    if not args.no_resume and args.output.exists():
        with open(args.output) as f:
            for line in f:
                doc = json.loads(line)
                processed.add(doc.get("image_path", ""))
        print(f"Resuming: {len(processed)} already processed")

    images = [img for img in all_images if str(img) not in processed]
    print(f"Processing {len(images)} new images in {args.mode} mode")

    if not images:
        print("Nothing to do.")
        return

    # Load model
    pt_model = None
    if args.mode == "pytorch":
        pt_model = load_pytorch_model(args.model, args.device)

    # Process
    count = 0
    errors = 0
    start_time = time.time()
    mode = "a" if not args.no_resume and args.output.exists() else "w"

    with open(args.output, mode) as out:
        for i in range(0, len(images), args.batch_size):
            batch = images[i : i + args.batch_size]

            try:
                if args.mode == "pytorch":
                    embeddings = embed_images_pytorch(batch, pt_model, args.batch_size)
                else:
                    descriptions = [
                        f"Grape leaf image classified as {classify_from_path(p)}"
                        for p in batch
                    ]
                    embeddings = embed_images_ollama(descriptions, args.ollama_url, args.ollama_model)

                for img_path, embedding in zip(batch, embeddings):
                    doc = {
                        "timestamp": "2024-01-01T00:00:00Z",
                        "vineyard_id": "grape-disease-dataset",
                        "block_id": "disease-ref",
                        "source": "historical",
                        "image_path": str(img_path),
                        "image_type": "leaf",
                        "classification": classify_from_path(img_path),
                        "confidence": 1.0,
                        "description": f"Grape leaf: {classify_from_path(img_path)}",
                        "image_embedding": embedding,
                    }
                    out.write(json.dumps(doc) + "\n")
                    count += 1

            except Exception as e:
                errors += len(batch)
                if errors <= 10:
                    print(f"  Error on batch at {batch[0].name}: {e}")

            if count > 0 and count % 200 == 0:
                elapsed = time.time() - start_time
                rate = count / elapsed
                eta = (len(images) - count) / rate if rate > 0 else 0
                print(f"  {count}/{len(images)} ({count*100//len(images)}%) "
                      f"| {rate:.1f} img/s | ETA {eta:.0f}s")

    elapsed = time.time() - start_time
    print(f"\nDone: {count} embedded, {errors} errors in {elapsed:.1f}s → {args.output}")
    if count > 0:
        # Verify embedding dimensions
        with open(args.output) as f:
            sample = json.loads(f.readline())
            dims = len(sample.get("image_embedding", []))
            print(f"Embedding dimensions: {dims}")


if __name__ == "__main__":
    main()
