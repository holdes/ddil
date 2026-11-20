"""Text embedding on the airgapped kit.

Two local backends, both on the DGX Spark:
  - Ollama `/api/embed` (EMBED_MODEL). `embed_text` / `embed_batch` use it; the
    vineyard search and CCS collect paths call these and are unchanged.
  - Jina Embeddings v5 Omni, OpenAI-style `POST {JINA_OMNI_URL}/v1/embeddings`
    (JINA_OMNI_MODEL). `embed_jina` uses it.

`embed_sec_query` picks the SEC query embedder from EMBED_BACKEND ("jina" by
default, "ollama" as the fallback). The SEC corpus must be embedded with the
same backend, model and dims (demo/scripts/finance/reembed-local.py).
"""

import httpx

from app.config import settings


async def embed_text(text: str) -> list[float]:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.OLLAMA_EMBED_URL}/api/embed",
            json={"model": settings.EMBED_MODEL, "input": text},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["embeddings"][0]


async def embed_batch(texts: list[str]) -> list[list[float]]:
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{settings.OLLAMA_EMBED_URL}/api/embed",
            json={"model": settings.EMBED_MODEL, "input": texts},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["embeddings"]


async def embed_jina(texts: list[str], dims: int | None = None) -> list[list[float]]:
    """Embed texts with Jina Embeddings v5 Omni on the kit.

    POST {JINA_OMNI_URL}/v1/embeddings {"model", "input": [...], "dimensions"}
    and read data[i].embedding, ordered by data[i].index when present.
    """
    body: dict = {"model": settings.JINA_OMNI_MODEL, "input": texts}
    if dims:
        body["dimensions"] = dims
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(f"{settings.JINA_OMNI_URL}/v1/embeddings", json=body)
        resp.raise_for_status()
        data = resp.json()["data"]
    data = sorted(data, key=lambda d: d.get("index", 0))
    return [d["embedding"] for d in data]


async def embed_sec_query(text: str) -> list[float]:
    """Embed one SEC search query with the configured backend."""
    if settings.EMBED_BACKEND == "ollama":
        return await embed_text(text)
    vecs = await embed_jina([text], dims=settings.SEC_EMBED_DIMS)
    return vecs[0]


def sec_embed_model_name() -> str:
    return settings.EMBED_MODEL if settings.EMBED_BACKEND == "ollama" else settings.JINA_OMNI_MODEL
