"""Phase 0: Sensor Snapshot — ES-only, no LLM call."""

from __future__ import annotations

import logging
from typing import Callable, Optional

from app.models.agent_models import SensorSnapshot
from app.services.elasticsearch import get_gpu_client

logger = logging.getLogger(__name__)


def _progress(on_progress: Optional[Callable], msg: str) -> None:
    if on_progress:
        on_progress(msg)


async def run_phase0(
    block_id: Optional[str] = None,
    on_progress: Optional[Callable] = None,
) -> SensorSnapshot:
    """Fetch current sensor data from Elasticsearch. No LLM needed."""
    _progress(on_progress, "Querying sensor indices...")

    es = get_gpu_client()
    if es is None:
        _progress(on_progress, "ES unavailable — using simulated data")
        return _mock_snapshot(block_id)

    try:
        # Latest soil reading
        soil_query: dict = {"size": 1, "sort": [{"timestamp": {"order": "desc"}}]}
        if block_id:
            soil_query["query"] = {"term": {"block_id": block_id}}
        else:
            soil_query["query"] = {"match_all": {}}

        soil_resp = await es.search(index="vineyard-soil", body=soil_query)
        soil_hits = soil_resp.get("hits", {}).get("hits", [])

        # Latest NPK reading
        npk_query: dict = {"size": 1, "sort": [{"timestamp": {"order": "desc"}}]}
        if block_id:
            npk_query["query"] = {"term": {"block_id": block_id}}
        else:
            npk_query["query"] = {"match_all": {}}

        npk_resp = await es.search(index="vineyard-npk", body=npk_query)
        npk_hits = npk_resp.get("hits", {}).get("hits", [])

        soil = soil_hits[0]["_source"] if soil_hits else {}
        npk = npk_hits[0]["_source"] if npk_hits else {}

        bid = soil.get("block_id") or npk.get("block_id") or block_id or "BLK-A"
        _progress(on_progress, f"Retrieved sensor data for {bid} ({soil.get('block_name', '')})")

        moisture = soil.get("soil_moisture_pct")
        potassium = npk.get("soil_potassium_mgkg")

        # Determine health
        health = "healthy"
        if moisture is not None and moisture < 25:
            health = "alert"
        elif moisture is not None and moisture > 45:
            health = "watch"
        if potassium is not None and potassium < 100:
            health = "alert"

        return SensorSnapshot(
            block_id=bid,
            moisture=moisture,
            temperature=soil.get("soil_temp_6in_c"),
            nitrogen=npk.get("soil_nitrogen_mgkg"),
            phosphorus=npk.get("soil_phosphorus_mgkg"),
            potassium=potassium,
            ph=npk.get("ph"),
            health_status=health,
            summary=_summarize(soil, npk),
        )
    except Exception as e:
        logger.warning("Phase 0 ES query failed: %s", e)
        _progress(on_progress, "ES query failed — using simulated data")
        return _mock_snapshot(block_id)


def _summarize(soil: dict, npk: dict) -> str:
    parts = []
    if vwc := soil.get("soil_moisture_pct"):
        status = "drought stress" if vwc < 25 else "low" if vwc < 32 else "optimal" if vwc < 42 else "saturated"
        parts.append(f"Moisture {vwc:.1f}% ({status})")
    if temp := soil.get("soil_temp_6in_c"):
        parts.append(f"Soil temp {temp:.1f}°C")
    if ec := soil.get("electrical_conductivity"):
        parts.append(f"EC {ec:.2f} dS/m")
    if n := npk.get("soil_nitrogen_mgkg"):
        parts.append(f"N:{n:.0f}")
    if p := npk.get("soil_phosphorus_mgkg"):
        parts.append(f"P:{p:.0f}")
    if k := npk.get("soil_potassium_mgkg"):
        parts.append(f"K:{k:.0f} mg/kg")
    if ph := npk.get("ph"):
        parts.append(f"pH:{ph:.1f}")
    return " | ".join(parts) if parts else "No sensor data available"


def _mock_snapshot(block_id: Optional[str] = None) -> SensorSnapshot:
    return SensorSnapshot(
        block_id=block_id or "BLK-C",
        moisture=46.2,
        temperature=17.8,
        nitrogen=52.0,
        phosphorus=33.0,
        potassium=50.0,
        ph=6.8,
        health_status="alert",
        summary="Moisture 46.2% (saturated) | Soil temp 17.8°C | EC 0.78 dS/m | K:50 mg/kg",
    )
