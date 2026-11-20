"""LLM integration (local, airgapped).

Two backends, picked by settings.LLM_BACKEND:
  "vllm"   → vLLM OpenAI-compatible API on the DGX Spark (default):
             POST {VLLM_URL}/v1/chat/completions, streaming via SSE `data:` lines.
             Serves NVIDIA Nemotron 3.5 Lightning. LLM_MODEL is used when the
             server lists it in GET /v1/models; otherwise the first served id.
  "ollama" → Ollama native API, POST {OLLAMA_LLM_URL}/api/chat (previous path).

Nemotron can emit reasoning. Only the answer text is returned: the separate
`reasoning_content` field is ignored, and a leading <think>...</think> block in
the content is dropped.
"""

import json
import re
from typing import AsyncIterator

import httpx

from app.config import settings

_THINK_RE = re.compile(r"^\s*<think>.*?</think>\s*", re.DOTALL)

# Cached result of the vLLM /v1/models lookup (resolved once per process).
_resolved_vllm_model: str | None = None


def _backend() -> str:
    return (settings.LLM_BACKEND or "vllm").strip().lower()


def _strip_reasoning(text: str) -> str:
    return _THINK_RE.sub("", text or "", count=1)


async def resolve_model() -> str:
    """Model id sent to the LLM server.

    vllm: LLM_MODEL if /v1/models lists it, else the first served id. The lookup
    is cached; on a failed lookup LLM_MODEL is used and the lookup retried later.
    ollama: LLM_MODEL as configured.
    """
    global _resolved_vllm_model
    if _backend() != "vllm":
        return settings.LLM_MODEL
    if _resolved_vllm_model:
        return _resolved_vllm_model
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.VLLM_URL}/v1/models", headers=_vllm_headers())
            resp.raise_for_status()
            ids = [m.get("id") for m in resp.json().get("data", []) if m.get("id")]
    except Exception:
        return settings.LLM_MODEL
    if not ids:
        return settings.LLM_MODEL
    _resolved_vllm_model = settings.LLM_MODEL if settings.LLM_MODEL in ids else ids[0]
    return _resolved_vllm_model


def model_label() -> str:
    """Model id for display: the resolved vLLM id once known, else LLM_MODEL."""
    if _backend() == "vllm" and _resolved_vllm_model:
        return _resolved_vllm_model
    return settings.LLM_MODEL


def _vllm_headers() -> dict:
    return {"Authorization": f"Bearer {settings.VLLM_API_KEY}"} if settings.VLLM_API_KEY else {}


async def chat_messages(
    messages: list[dict],
    max_tokens: int | None = None,
    temperature: float | None = None,
    timeout: float = 120,
) -> str:
    """Send a full message list and return the answer text (non-streaming)."""
    model = await resolve_model()
    async with httpx.AsyncClient(timeout=timeout) as client:
        if _backend() == "vllm":
            body: dict = {"model": model, "messages": messages, "stream": False}
            if max_tokens is not None:
                body["max_tokens"] = max_tokens
            if temperature is not None:
                body["temperature"] = temperature
            resp = await client.post(
                f"{settings.VLLM_URL}/v1/chat/completions", json=body, headers=_vllm_headers()
            )
            resp.raise_for_status()
            choices = resp.json().get("choices") or [{}]
            msg = choices[0].get("message") or {}
            # reasoning_content (if present) is deliberately ignored
            return _strip_reasoning(msg.get("content") or "")

        body = {"model": model, "messages": messages, "stream": False}
        options: dict = {}
        if max_tokens is not None:
            options["num_predict"] = max_tokens
        if temperature is not None:
            options["temperature"] = temperature
        if options:
            body["options"] = options
        resp = await client.post(f"{settings.OLLAMA_LLM_URL}/api/chat", json=body)
        resp.raise_for_status()
        return resp.json()["message"]["content"]


async def stream_messages(
    messages: list[dict],
    max_tokens: int | None = None,
    temperature: float | None = None,
    timeout: float = 120,
) -> AsyncIterator[str]:
    """Yield answer-text deltas. vllm: SSE `data:` lines; ollama: NDJSON lines.

    Reasoning deltas (`reasoning_content`) are skipped.
    """
    model = await resolve_model()
    async with httpx.AsyncClient(timeout=timeout) as client:
        if _backend() == "vllm":
            body: dict = {"model": model, "messages": messages, "stream": True}
            if max_tokens is not None:
                body["max_tokens"] = max_tokens
            if temperature is not None:
                body["temperature"] = temperature
            async with client.stream(
                "POST", f"{settings.VLLM_URL}/v1/chat/completions", json=body, headers=_vllm_headers()
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    for choice in chunk.get("choices") or []:
                        piece = (choice.get("delta") or {}).get("content")
                        if piece:
                            yield piece
            return

        body = {"model": model, "messages": messages, "stream": True}
        options: dict = {}
        if max_tokens is not None:
            options["num_predict"] = max_tokens
        if temperature is not None:
            options["temperature"] = temperature
        if options:
            body["options"] = options
        async with client.stream("POST", f"{settings.OLLAMA_LLM_URL}/api/chat", json=body) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                piece = (chunk.get("message") or {}).get("content")
                if piece:
                    yield piece
                if chunk.get("done"):
                    break


async def invoke_llm(
    prompt: str,
    system: str = "",
    max_tokens: int = 4000,
    temperature: float = 0.1,
) -> str:
    """Call the local LLM with a single prompt."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return await chat_messages(messages, max_tokens=max_tokens, temperature=temperature)


async def invoke_llm_json(
    prompt: str,
    system: str = "",
    max_tokens: int = 4000,
    temperature: float = 0.1,
) -> dict:
    """Call LLM and parse JSON response. Falls back to raw text on parse failure."""
    text = await invoke_llm(prompt, system, max_tokens, temperature)

    # Try to extract JSON from response
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON block in markdown
    if "```json" in text:
        start = text.index("```json") + 7
        end = text.index("```", start)
        try:
            return json.loads(text[start:end].strip())
        except json.JSONDecodeError:
            pass
    elif "```" in text:
        start = text.index("```") + 3
        end = text.index("```", start)
        try:
            return json.loads(text[start:end].strip())
        except json.JSONDecodeError:
            pass

    # Find first { ... } block
    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start >= 0 and brace_end > brace_start:
        try:
            return json.loads(text[brace_start : brace_end + 1])
        except json.JSONDecodeError:
            pass

    return {"raw_response": text}
