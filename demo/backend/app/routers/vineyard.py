"""Vineyard configuration and block data endpoints."""

from fastapi import APIRouter

router = APIRouter()

# Vineyard config served to frontend for map rendering
VINEYARD_CONFIG = {
    "id": "domaine-cote-cachee",
    "name": "Domaine de la Côte Cachée",
    "region": "Walla Walla AVA, Washington",
    "center": {"lat": 46.0150, "lon": -118.3800},
    "zoom": 16,
    "blocks": [
        {
            "id": "BLK-A",
            "name": "Les Pierres",
            "variety": "Cabernet Sauvignon",
            "acres": 4.2,
            "elevation_m": 285,
            "aspect": "South",
            "soil_type": "Loess over basalt",
            "story": "Star performer — well-drained, south-facing, consistently top quality.",
            "polygon": [
                {"lat": 46.0140, "lon": -118.3830},
                {"lat": 46.0140, "lon": -118.3810},
                {"lat": 46.0155, "lon": -118.3810},
                {"lat": 46.0155, "lon": -118.3830},
            ],
        },
        {
            "id": "BLK-B",
            "name": "Clos du Vent",
            "variety": "Syrah",
            "acres": 3.8,
            "elevation_m": 310,
            "aspect": "Southwest",
            "soil_type": "Shallow rocky",
            "story": "Wind-exposed ridge — drought-vulnerable but produces concentrated fruit.",
            "polygon": [
                {"lat": 46.0160, "lon": -118.3835},
                {"lat": 46.0160, "lon": -118.3818},
                {"lat": 46.0173, "lon": -118.3818},
                {"lat": 46.0173, "lon": -118.3835},
            ],
        },
        {
            "id": "BLK-C",
            "name": "La Rivière",
            "variety": "Merlot",
            "acres": 5.1,
            "elevation_m": 245,
            "aspect": "East",
            "soil_type": "Alluvial clay",
            "story": "Riverside block — rich clay soil, moisture-retentive. Performance declining since 2022.",
            "polygon": [
                {"lat": 46.0125, "lon": -118.3800},
                {"lat": 46.0125, "lon": -118.3775},
                {"lat": 46.0142, "lon": -118.3775},
                {"lat": 46.0142, "lon": -118.3800},
            ],
        },
        {
            "id": "BLK-D",
            "name": "Le Jardin",
            "variety": "Chardonnay",
            "acres": 3.5,
            "elevation_m": 260,
            "aspect": "Northeast",
            "soil_type": "Sandy loam",
            "story": "Protected garden block — good for whites but prone to disease in wet years.",
            "polygon": [
                {"lat": 46.0145, "lon": -118.3770},
                {"lat": 46.0145, "lon": -118.3752},
                {"lat": 46.0158, "lon": -118.3752},
                {"lat": 46.0158, "lon": -118.3770},
            ],
        },
        {
            "id": "BLK-E",
            "name": "Vieilles Vignes",
            "variety": "Cabernet Franc",
            "acres": 2.8,
            "elevation_m": 295,
            "aspect": "South",
            "soil_type": "Volcanic, deep",
            "story": "35-year-old vines — deep roots buffer against extremes. Remarkably consistent.",
            "polygon": [
                {"lat": 46.0158, "lon": -118.3805},
                {"lat": 46.0158, "lon": -118.3790},
                {"lat": 46.0168, "lon": -118.3790},
                {"lat": 46.0168, "lon": -118.3805},
            ],
        },
        {
            "id": "BLK-F",
            "name": "Le Plateau",
            "variety": "Riesling",
            "acres": 2.2,
            "elevation_m": 320,
            "aspect": "North",
            "soil_type": "Limestone-rich, chalky",
            "story": "Highest elevation — cool nights preserve acidity. Small but distinctive.",
            "polygon": [
                {"lat": 46.0175, "lon": -118.3798},
                {"lat": 46.0175, "lon": -118.3785},
                {"lat": 46.0183, "lon": -118.3785},
                {"lat": 46.0183, "lon": -118.3798},
            ],
        },
    ],
}


@router.get("/config")
async def get_config():
    """Return vineyard definition for map rendering."""
    return VINEYARD_CONFIG


@router.get("/blocks/{block_id}/summary")
async def get_block_summary(block_id: str):
    """Return latest sensor readings and status for a block."""
    from app.services.elasticsearch import get_gpu_client
    es = get_gpu_client()

    # Get latest soil reading
    soil = {}
    try:
        resp = await es.search(
            index="vineyard-soil",
            body={
                "size": 1,
                "query": {"term": {"block_id": block_id}},
                "sort": [{"timestamp": "desc"}],
            },
        )
        if resp["hits"]["hits"]:
            soil = resp["hits"]["hits"][0]["_source"]
    except Exception:
        pass

    # Get latest NPK reading
    npk = {}
    try:
        resp = await es.search(
            index="vineyard-npk",
            body={
                "size": 1,
                "query": {"term": {"block_id": block_id}},
                "sort": [{"timestamp": "desc"}],
            },
        )
        if resp["hits"]["hits"]:
            npk = resp["hits"]["hits"][0]["_source"]
    except Exception:
        pass

    # Get latest harvest
    harvest = {}
    try:
        resp = await es.search(
            index="vineyard-harvest",
            body={
                "size": 1,
                "query": {"term": {"block_id": block_id}},
                "sort": [{"timestamp": "desc"}],
            },
        )
        if resp["hits"]["hits"]:
            harvest = resp["hits"]["hits"][0]["_source"]
    except Exception:
        pass

    # Compute health status
    moisture = soil.get("soil_moisture_pct", 35)
    k = npk.get("soil_potassium_mgkg", 180)
    health = "healthy"
    alerts = []
    if moisture < 25:
        health = "alert"
        alerts.append({"type": "drought", "message": f"Soil moisture critically low ({moisture:.1f}%)"})
    elif moisture < 32:
        health = "watch"
        alerts.append({"type": "moisture", "message": f"Soil moisture below optimal ({moisture:.1f}%)"})
    if moisture > 45:
        health = "watch"
        alerts.append({"type": "saturation", "message": f"Soil moisture high ({moisture:.1f}%) — check drainage"})
    if k < 100:
        health = "alert"
        alerts.append({"type": "nutrient", "message": f"Potassium deficient ({k:.0f} mg/kg)"})
    elif k < 140:
        if health != "alert":
            health = "watch"
        alerts.append({"type": "nutrient", "message": f"Potassium declining ({k:.0f} mg/kg)"})

    block_config = next((b for b in VINEYARD_CONFIG["blocks"] if b["id"] == block_id), None)

    return {
        "block_id": block_id,
        "block_name": block_config["name"] if block_config else block_id,
        "variety": block_config["variety"] if block_config else "Unknown",
        "health": health,
        "alerts": alerts,
        "soil": {
            "moisture_pct": soil.get("soil_moisture_pct"),
            "temp_6in_c": soil.get("soil_temp_6in_c"),
            "temp_12in_c": soil.get("soil_temp_12in_c"),
            "ec": soil.get("electrical_conductivity"),
            "timestamp": soil.get("timestamp"),
        },
        "npk": {
            "nitrogen": npk.get("soil_nitrogen_mgkg"),
            "phosphorus": npk.get("soil_phosphorus_mgkg"),
            "potassium": npk.get("soil_potassium_mgkg"),
            "ph": npk.get("ph"),
            "timestamp": npk.get("timestamp"),
        },
        "latest_harvest": {
            "vintage_year": harvest.get("vintage_year"),
            "grape_mass_kg": harvest.get("grape_mass_kg"),
            "sugar_brix": harvest.get("sugar_brix"),
            "quality_score": harvest.get("quality_score"),
        },
    }


@router.get("/dashboard")
async def get_dashboard():
    """Return vineyard-wide KPIs."""
    from app.services.elasticsearch import get_gpu_client
    es = get_gpu_client()

    block_ids = [b["id"] for b in VINEYARD_CONFIG["blocks"]]
    summaries = []

    for block_id in block_ids:
        try:
            resp = await es.search(
                index="vineyard-soil",
                body={
                    "size": 1,
                    "query": {"term": {"block_id": block_id}},
                    "sort": [{"timestamp": "desc"}],
                },
            )
            if resp["hits"]["hits"]:
                src = resp["hits"]["hits"][0]["_source"]
                summaries.append({
                    "block_id": block_id,
                    "moisture": src.get("soil_moisture_pct", 0),
                    "temp": src.get("soil_temp_6in_c", 0),
                    "ec": src.get("electrical_conductivity", 0),
                })
        except Exception:
            pass

    # Aggregate
    avg_moisture = sum(s["moisture"] for s in summaries) / max(1, len(summaries))
    avg_temp = sum(s["temp"] for s in summaries) / max(1, len(summaries))

    # Count docs across indices
    counts = {}
    for idx in ["vineyard-soil", "vineyard-npk", "vineyard-imagery", "vineyard-harvest", "vineyard-wine"]:
        try:
            resp = await es.count(index=idx)
            counts[idx] = resp["count"]
        except Exception:
            counts[idx] = 0

    return {
        "vineyard": VINEYARD_CONFIG["name"],
        "total_docs": sum(counts.values()),
        "index_counts": counts,
        "avg_moisture": round(avg_moisture, 1),
        "avg_temp": round(avg_temp, 1),
        "block_summaries": summaries,
        "blocks_total": len(block_ids),
    }
