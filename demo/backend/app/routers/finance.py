"""Finance demo router (chapters 03 + 04).

Endpoints
---------
GET  /api/finance/sectors             list of distinct sectors in sec_10k_2026
POST /api/finance/search              query embed (Jina v5 Omni on the kit) → ES kNN; returns hits + the raw ES request body
POST /api/finance/agent/chat          SSE proxy to Kibana Agent Builder (kit Kibana, KIBANA_SPACE)
GET  /api/finance/agent/state         compact "what's wired" summary for chapter 04 sidebar
"""

from __future__ import annotations

import json
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.services.embedder import embed_sec_query, sec_embed_model_name

router = APIRouter()


# ─────────────── Query embedding (on the kit) ────────────────────────────────
async def _embed_query(text: str) -> list[float]:
    """Embed a search query on the kit: Jina v5 Omni (default) or Ollama (fallback)."""
    return await embed_sec_query(text)


def _embed_model_name() -> str:
    return sec_embed_model_name()


def _embed_vector_label() -> str:
    """What the audience sees in place of the elided query vector."""
    if settings.EMBED_BACKEND == "ollama":
        return f"<{settings.SEC_EMBED_DIMS}-d embedding from {settings.EMBED_MODEL} via Ollama on the DGX Spark>"
    return f"<{settings.SEC_EMBED_DIMS}-d embedding from Jina Embeddings v5 Omni ({settings.JINA_OMNI_MODEL}) on the DGX Spark>"


# ─────────────── ES helpers ──────────────────────────────────────────────────
def _es_url(path: str) -> str:
    return f"{settings.es_gpu_url}{path}"


def _es_auth() -> tuple[str, str] | None:
    """Basic-auth tuple for ES calls when security is on; None otherwise."""
    if settings.ES_USER and settings.ES_PASSWORD:
        return (settings.ES_USER, settings.ES_PASSWORD)
    return None


def _kbn_auth() -> tuple[str, str] | None:
    if settings.KIBANA_USER and settings.KIBANA_PASSWORD:
        return (settings.KIBANA_USER, settings.KIBANA_PASSWORD)
    return None


# ─────────────── Search (chapter 03) ─────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str = Field(..., description="Natural-language query")
    size: int = Field(8, ge=1, le=50)
    sectors: list[str] | None = Field(default=None, description="Optional GICS sector filter chips")


@router.post("/search")
async def finance_search(req: SearchRequest):
    """Embed the query on the kit and run a kNN against sec_10k_2026.

    Returns both the hits and the raw ES request body so chapter 03's
    'show the call' panel can display the actual API call alongside results.
    """
    try:
        vec = await _embed_query(req.query)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Query embed failed ({settings.EMBED_BACKEND}): {e}")

    es_body: dict[str, Any] = {
        "knn": {
            "field": "emb",
            "query_vector": vec,
            "k": req.size,
            "num_candidates": max(req.size * 10, 50),
        },
        "_source": ["ticker", "company", "sector", "cik", "accession", "source_url", "chunk_idx", "text"],
        "size": req.size,
    }
    if req.sectors:
        es_body["knn"]["filter"] = {"terms": {"sector": req.sectors}}

    async with httpx.AsyncClient(timeout=30, auth=_es_auth()) as c:
        r = await c.post(_es_url(f"/{settings.SEC_INDEX}/_search"), json=es_body)
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)

    res = r.json()
    hits = []
    for h in res.get("hits", {}).get("hits", []):
        s = h.get("_source", {})
        text = s.get("text", "")
        hits.append({
            "id": h.get("_id"),
            "score": h.get("_score"),
            "ticker": s.get("ticker"),
            "company": s.get("company"),
            "sector": s.get("sector"),
            "cik": s.get("cik"),
            "accession": s.get("accession"),
            "source_url": s.get("source_url"),
            "chunk_idx": s.get("chunk_idx"),
            "text": text,
            "snippet": text[:480] + ("…" if len(text) > 480 else ""),
        })

    # The "request body" we return is the kNN payload with the vector elided so
    # the UI can show a clean example without the raw vector noise.
    show_body = {
        **es_body,
        "knn": {
            **es_body["knn"],
            "query_vector": _embed_vector_label(),
        },
    }
    return {
        "took_ms": res.get("took"),
        "total": res.get("hits", {}).get("total", {}).get("value"),
        "hits": hits,
        "request": {
            "method": "POST",
            "path": f"/{settings.SEC_INDEX}/_search",
            "body": show_body,
        },
        "embed_model": _embed_model_name(),
        "embed_dims": len(vec),
    }


@router.get("/sectors")
async def list_sectors():
    """Distinct sectors in sec_10k_2026 — drives the filter-chip row in the UI."""
    body = {
        "size": 0,
        "aggs": {"sectors": {"terms": {"field": "sector", "size": 30, "order": {"_count": "desc"}}}},
    }
    async with httpx.AsyncClient(timeout=10, auth=_es_auth()) as c:
        r = await c.post(_es_url(f"/{settings.SEC_INDEX}/_search"), json=body)
    r.raise_for_status()
    buckets = r.json().get("aggregations", {}).get("sectors", {}).get("buckets", [])
    return [{"name": b["key"], "count": b["doc_count"]} for b in buckets]


# ─────────────── Agent Builder proxy (chapter 04) ────────────────────────────
class AgentChatRequest(BaseModel):
    input: str
    agent_id: str | None = None
    conversation_id: str | None = None


@router.get("/agent/state")
async def agent_state():
    """Show chapter 04 what's wired — useful for the sidebar 'Configuration' card."""
    return {
        "kibana_url":     settings.kibana_space_url,
        "es_url":         settings.es_gpu_url,
        "space":          settings.KIBANA_SPACE,
        "agent_id":       settings.AGENT_BUILDER_AGENT_ID,
        "connector_id":   settings.AGENT_BUILDER_CONNECTOR_ID,
        "llm_model":      settings.SEC_AGENT_LLM_MODEL,
        "embed_model":    _embed_model_name(),
        "embed_backend":  settings.EMBED_BACKEND,
        "sec_index":      settings.SEC_INDEX,
        "es_inference":   settings.ES_INFERENCE_LLM_ID,
    }


@router.post("/agent/chat")
async def agent_chat(req: AgentChatRequest, request: Request):
    """Stream Agent Builder SSE through to the browser.

    Matches the pattern from hive-mind/patterns/agent-builder/AGENT_BUILDER_INTEGRATION.md:
    use chunk-streaming (NOT iter_lines) so SSE event boundaries are preserved.
    """
    body = {
        "input": req.input,
        "agent_id": req.agent_id or settings.AGENT_BUILDER_AGENT_ID,
        "connector_id": settings.AGENT_BUILDER_CONNECTOR_ID,
    }
    if req.conversation_id:
        body["conversation_id"] = req.conversation_id

    upstream_url = f"{settings.kibana_space_url}/api/agent_builder/converse/async"
    headers = {
        "Content-Type": "application/json",
        "kbn-xsrf": "true",
        "x-elastic-internal-origin": "kibana",
    }
    # Bearer / ApiKey auth would go here if Kibana security were on; ours is off.

    async def event_generator():
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(connect=10, read=None, write=30, pool=10),
                auth=_kbn_auth(),
            ) as c:
                async with c.stream("POST", upstream_url, json=body, headers=headers) as resp:
                    if resp.status_code >= 400:
                        msg = (await resp.aread()).decode(errors="replace")[:500]
                        err = json.dumps({"event": "error", "data": {"message": f"agent builder {resp.status_code}: {msg}"}})
                        yield f"event: error\ndata: {err}\n\n".encode()
                        return
                    async for chunk in resp.aiter_raw():
                        if await request.is_disconnected():
                            return
                        if chunk:
                            yield chunk
        except httpx.RemoteProtocolError:
            # Agent Builder may close the stream cleanly after message_complete
            return
        except Exception as e:
            err = json.dumps({"event": "error", "data": {"message": repr(e)}})
            yield f"event: error\ndata: {err}\n\n".encode()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
