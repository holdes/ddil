#!/bin/bash
# ============================================================
# Create Elasticsearch indices on the ddil-vineyard cluster
#
# Usage: ./setup-indices.sh [ES_URL]
#
# Creates:
#   - App indices (no allocation filtering — cluster decides placement)
#   - Race index pairs (allocation-filtered to gpu/cpu nodes)
# ============================================================
set -euo pipefail

ES_URL="${1:-http://localhost:9200}"

create_index() {
  local index="$1"
  local mapping="$2"

  if curl -s -o /dev/null -w "%{http_code}" "$ES_URL/$index" | grep -q "200"; then
    echo "  $index — already exists, skipping."
    return
  fi

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$ES_URL/$index" \
    -H "Content-Type: application/json" \
    -d "$mapping")

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  $index — created."
  else
    echo "  $index — FAILED (HTTP $HTTP_CODE)"
  fi
}

# ── Shared field mappings ────────────────────────────────────

SOIL_FIELDS='{
  "timestamp": {"type": "date"},
  "vineyard_id": {"type": "keyword"},
  "block_id": {"type": "keyword"},
  "station_id": {"type": "keyword"},
  "location": {"type": "geo_point"},
  "source": {"type": "keyword"},
  "soil_moisture_pct": {"type": "float"},
  "soil_temp_6in_c": {"type": "float"},
  "soil_temp_12in_c": {"type": "float"},
  "soil_temp_24in_c": {"type": "float"},
  "electrical_conductivity": {"type": "float"},
  "depth_cm": {"type": "integer"},
  "reading_vector": {"type": "dense_vector", "dims": 8, "index": true, "similarity": "cosine"}
}'

NPK_FIELDS='{
  "timestamp": {"type": "date"},
  "vineyard_id": {"type": "keyword"},
  "block_id": {"type": "keyword"},
  "source": {"type": "keyword"},
  "location": {"type": "geo_point"},
  "soil_nitrogen_mgkg": {"type": "float"},
  "soil_phosphorus_mgkg": {"type": "float"},
  "soil_potassium_mgkg": {"type": "float"},
  "temperature_c": {"type": "float"},
  "humidity_pct": {"type": "float"},
  "ph": {"type": "float"},
  "rainfall_mm": {"type": "float"},
  "crop_suitability": {"type": "keyword"},
  "npk_vector": {"type": "dense_vector", "dims": 7, "index": true, "similarity": "cosine"}
}'

IMAGERY_FIELDS='{
  "timestamp": {"type": "date"},
  "vineyard_id": {"type": "keyword"},
  "block_id": {"type": "keyword"},
  "source": {"type": "keyword"},
  "location": {"type": "geo_point"},
  "image_path": {"type": "keyword"},
  "image_type": {"type": "keyword"},
  "classification": {"type": "keyword"},
  "confidence": {"type": "float"},
  "altitude_m": {"type": "float"},
  "description": {"type": "text", "analyzer": "english"},
  "image_embedding": {"type": "dense_vector", "dims": 768, "index": true, "similarity": "cosine"}
}'

HARVEST_FIELDS='{
  "timestamp": {"type": "date"},
  "vineyard_id": {"type": "keyword"},
  "block_id": {"type": "keyword"},
  "location": {"type": "geo_point"},
  "grape_mass_kg": {"type": "float"},
  "sugar_brix": {"type": "float"},
  "acidity": {"type": "float"},
  "ph": {"type": "float"},
  "yan_mgL": {"type": "float"},
  "quality_score": {"type": "integer"},
  "variety": {"type": "keyword"},
  "vintage_year": {"type": "integer"}
}'

WINE_FIELDS='{
  "timestamp": {"type": "date"},
  "wine_type": {"type": "keyword"},
  "fixed_acidity": {"type": "float"},
  "volatile_acidity": {"type": "float"},
  "citric_acid": {"type": "float"},
  "residual_sugar": {"type": "float"},
  "chlorides": {"type": "float"},
  "free_sulfur_dioxide": {"type": "float"},
  "total_sulfur_dioxide": {"type": "float"},
  "density": {"type": "float"},
  "ph": {"type": "float"},
  "sulphates": {"type": "float"},
  "alcohol": {"type": "float"},
  "quality": {"type": "integer"}
}'

# ── Helper to build index body ───────────────────────────────

index_body() {
  local fields="$1"
  local alloc_attr="${2:-}"  # empty = no allocation filtering

  local settings='"number_of_shards": 1, "number_of_replicas": 0'
  if [ -n "$alloc_attr" ]; then
    settings="$settings, \"index.routing.allocation.require.accel\": \"$alloc_attr\""
  fi

  echo "{\"settings\": {$settings}, \"mappings\": {\"properties\": $fields}}"
}

# ── App indices (no allocation filtering) ────────────────────

echo "Creating app indices on cluster ($ES_URL):"
create_index "vineyard-soil"    "$(index_body "$SOIL_FIELDS")"
create_index "vineyard-npk"     "$(index_body "$NPK_FIELDS")"
create_index "vineyard-imagery" "$(index_body "$IMAGERY_FIELDS")"
create_index "vineyard-harvest" "$(index_body "$HARVEST_FIELDS")"
create_index "vineyard-wine"    "$(index_body "$WINE_FIELDS")"

echo ""

# ── Race indices (allocation-filtered to specific nodes) ─────

echo "Creating race indices (GPU-pinned):"
create_index "race-soil-gpu"    "$(index_body "$SOIL_FIELDS" "gpu")"
create_index "race-npk-gpu"     "$(index_body "$NPK_FIELDS" "gpu")"
create_index "race-imagery-gpu" "$(index_body "$IMAGERY_FIELDS" "gpu")"

echo ""

echo "Creating race indices (CPU-pinned):"
create_index "race-soil-cpu"    "$(index_body "$SOIL_FIELDS" "cpu")"
create_index "race-npk-cpu"     "$(index_body "$NPK_FIELDS" "cpu")"
create_index "race-imagery-cpu" "$(index_body "$IMAGERY_FIELDS" "cpu")"

echo ""
echo "Done. Cluster health:"
curl -s "$ES_URL/_cluster/health?pretty"
