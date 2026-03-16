"""Phase 1: Historical Context — kNN search + LLM analysis."""

from __future__ import annotations

import logging
from typing import Callable, Optional

from app.models.agent_models import HistoricalContext, HistoricalMatch, SensorSnapshot
from app.services.elasticsearch import get_gpu_client
from app.services.llm import invoke_llm_json
from app.services.phases.prompts import SYSTEM_AGRONOMIST, PHASE1_HISTORICAL

logger = logging.getLogger(__name__)


def _progress(on_progress: Optional[Callable], msg: str) -> None:
    if on_progress:
        on_progress(msg)


def _normalize(value, min_val, max_val):
    if max_val == min_val:
        return 0.0
    return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))


async def run_phase1(
    sensor: SensorSnapshot,
    on_progress: Optional[Callable] = None,
) -> HistoricalContext:
    """Find similar historical conditions via kNN, then LLM-analyze patterns."""
    _progress(on_progress, "Building query vector from current conditions...")

    # Build an 8-dim reading_vector from sensor snapshot to match the index vectors
    query_vector = [
        _normalize(sensor.moisture or 35, 0, 60),
        _normalize(sensor.temperature or 18, -10, 45),
        _normalize((sensor.temperature or 18) - 1.2, -10, 45),
        _normalize((sensor.temperature or 18) - 2.8, -10, 45),
        _normalize(0.45, 0, 2.0),  # EC estimate
        _normalize(30, 0, 150),     # depth mid-range
        _normalize(12, 0, 24),      # noon
        _normalize(180, 1, 366),    # mid-year
    ]

    es = get_gpu_client()
    historical_hits: list[dict] = []

    if es is not None:
        try:
            _progress(on_progress, "Running kNN search against 841K+ historical soil records...")

            body: dict = {
                "size": 5,
                "knn": {
                    "field": "reading_vector",
                    "query_vector": query_vector,
                    "k": 5,
                    "num_candidates": 100,
                },
                "_source": [
                    "timestamp", "block_id", "block_name", "station_id",
                    "soil_moisture_pct", "soil_temp_6in_c", "electrical_conductivity",
                    "depth_cm", "variety", "air_temp_c", "precip_mm",
                ],
            }

            # Optionally filter to same block for "what happened here before"
            if sensor.block_id:
                body["knn"]["filter"] = {"term": {"block_id": sensor.block_id}}

            resp = await es.search(index="vineyard-soil", body=body)
            for hit in resp.get("hits", {}).get("hits", []):
                src = hit["_source"]
                historical_hits.append({
                    "score": hit.get("_score", 0),
                    **src,
                })
            _progress(on_progress, f"Found {len(historical_hits)} similar historical conditions")
        except Exception as e:
            logger.warning("Phase 1 kNN search failed: %s", e)
            _progress(on_progress, f"kNN search failed: {e}")

    if not historical_hits:
        _progress(on_progress, "Using cached historical context")
        historical_hits = _mock_historical()

    # LLM analysis
    _progress(on_progress, "Analyzing historical patterns with GPT-OSS 120B...")
    prompt = PHASE1_HISTORICAL.format(
        sensor_context=sensor.summary,
        historical_hits=_format_hits(historical_hits),
    )

    result = await invoke_llm_json(prompt, system=SYSTEM_AGRONOMIST)

    if "raw_response" in result:
        return HistoricalContext(
            matches=[],
            pattern_summary=result.get("raw_response", "Analysis unavailable"),
            years_of_data=0,
        )

    matches = [HistoricalMatch(**m) for m in result.get("matches", [])]
    return HistoricalContext(
        matches=matches,
        pattern_summary=result.get("pattern_summary", ""),
        years_of_data=result.get("years_of_data", len(matches)),
    )


def _format_hits(hits: list[dict]) -> str:
    lines = []
    for i, h in enumerate(hits, 1):
        ts = h.get("timestamp", "?")
        block = h.get("block_name", h.get("block_id", "?"))
        lines.append(
            f"{i}. Date: {ts} | Block: {block} | "
            f"Moisture: {h.get('soil_moisture_pct', '?')}% | "
            f"Temp: {h.get('soil_temp_6in_c', '?')}°C | "
            f"EC: {h.get('electrical_conductivity', '?')} dS/m | "
            f"Precip: {h.get('precip_mm', '?')}mm | "
            f"Similarity: {h.get('score', 0):.3f}"
        )
    return "\n".join(lines) if lines else "No historical records found."


def _mock_historical() -> list[dict]:
    return [
        {
            "timestamp": "2020-07-15T14:00:00Z",
            "block_id": "BLK-B",
            "block_name": "Clos du Vent",
            "soil_moisture_pct": 22.5,
            "soil_temp_6in_c": 24.1,
            "electrical_conductivity": 0.38,
            "variety": "Syrah",
            "score": 0.94,
        },
        {
            "timestamp": "2022-05-20T10:00:00Z",
            "block_id": "BLK-C",
            "block_name": "La Rivière",
            "soil_moisture_pct": 48.2,
            "soil_temp_6in_c": 16.5,
            "electrical_conductivity": 0.72,
            "variety": "Merlot",
            "score": 0.87,
        },
    ]
