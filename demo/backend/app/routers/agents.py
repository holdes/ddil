"""Generic Agent Builder proxy — the one path every Choose-Your-Adventure chat uses.

Streams Kibana Agent Builder `/converse/async` SSE straight through to the browser
(chunk-streaming via aiter_raw so SSE event boundaries survive), parameterised by
`agent_id`. This replaces per-adventure hand-rolled LLM orchestration:
  vineyard → vineyard-advisor · research → research-assistant · sec → finance-analyst

The LLM connector MUST be tool-calling capable (Qwen3 via `ddil-agent-qwen3`);
Nemotron Lightning leaks tool-call tokens and is not usable here.
"""
from __future__ import annotations

import json

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import settings

router = APIRouter()


class ConverseRequest(BaseModel):
    input: str
    agent_id: str
    connector_id: str | None = None
    conversation_id: str | None = None


def _kbn_auth() -> tuple[str, str] | None:
    if settings.KIBANA_USER and settings.KIBANA_PASSWORD:
        return (settings.KIBANA_USER, settings.KIBANA_PASSWORD)
    return None


@router.post("/converse")
async def converse(req: ConverseRequest, request: Request):
    """Proxy one Agent Builder conversation round as an SSE stream.

    The browser renders the native events (message_chunk, tool_call, tool_result,
    reasoning, message_complete) so real tool-calls are visible in the UI.
    """
    body: dict = {
        "input": req.input,
        "agent_id": req.agent_id,
        "connector_id": req.connector_id or settings.AGENT_LLM_CONNECTOR,
    }
    if req.conversation_id:
        body["conversation_id"] = req.conversation_id

    url = f"{settings.kibana_space_url}/api/agent_builder/converse/async"
    headers = {
        "Content-Type": "application/json",
        "kbn-xsrf": "true",
        "x-elastic-internal-origin": "kibana",
    }

    async def event_generator():
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(connect=10, read=None, write=30, pool=10),
                auth=_kbn_auth(),
            ) as c:
                async with c.stream("POST", url, json=body, headers=headers) as resp:
                    if resp.status_code >= 400:
                        msg = (await resp.aread()).decode(errors="replace")[:500]
                        err = json.dumps({"data": {"message": f"agent builder {resp.status_code}: {msg}"}})
                        yield f"event: error\ndata: {err}\n\n".encode()
                        return
                    async for chunk in resp.aiter_raw():
                        if await request.is_disconnected():
                            return
                        if chunk:
                            yield chunk
        except httpx.RemoteProtocolError:
            return  # Agent Builder may close the stream cleanly after message_complete
        except Exception as e:  # noqa: BLE001
            err = json.dumps({"data": {"message": repr(e)}})
            yield f"event: error\ndata: {err}\n\n".encode()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
