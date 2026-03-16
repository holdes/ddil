#!/bin/bash
# ============================================================
# Bulk index synthetic vineyard data into ES cluster
# Run from the DGX Spark (has direct ES access on localhost:9200)
# ============================================================
set -euo pipefail

ES_URL="${1:-http://localhost:9200}"
DATA_DIR="$(cd "$(dirname "$0")/../data/synthetic" && pwd)"
BATCH=5000

index_jsonl() {
  local index="$1"
  local file="$2"
  local total
  total=$(wc -l < "$file")

  echo "Indexing $file → $index ($total docs, batch=$BATCH)"

  local count=0
  local batch_file
  batch_file=$(mktemp)

  while IFS= read -r line; do
    echo "{\"index\":{\"_index\":\"$index\"}}" >> "$batch_file"
    echo "$line" >> "$batch_file"
    count=$((count + 1))

    if [ $((count % BATCH)) -eq 0 ]; then
      curl -s -X POST "$ES_URL/_bulk" \
        -H "Content-Type: application/x-ndjson" \
        --data-binary @"$batch_file" > /dev/null
      printf "  %s / %s (%d%%)\r" "$count" "$total" $((count * 100 / total))
      > "$batch_file"
    fi
  done < "$file"

  # Flush remaining
  if [ -s "$batch_file" ]; then
    curl -s -X POST "$ES_URL/_bulk" \
      -H "Content-Type: application/x-ndjson" \
      --data-binary @"$batch_file" > /dev/null
  fi

  rm -f "$batch_file"
  echo "  $count / $total (100%) ✓"
}

echo "═══════════════════════════════════════"
echo "  Bulk Indexing Synthetic Vineyard Data"
echo "  ES: $ES_URL"
echo "═══════════════════════════════════════"
echo ""

# Index in order: small datasets first, soil last (biggest)
index_jsonl "vineyard-wine"    "$DATA_DIR/wine-quality.jsonl"
index_jsonl "vineyard-harvest" "$DATA_DIR/harvest-records.jsonl"
index_jsonl "vineyard-npk"     "$DATA_DIR/npk-profiles.jsonl"
index_jsonl "vineyard-soil"    "$DATA_DIR/soil-readings.jsonl"

echo ""
echo "Refreshing indices..."
curl -s -X POST "$ES_URL/vineyard-*/_refresh" > /dev/null

echo ""
echo "Final counts:"
curl -s "$ES_URL/_cat/indices/vineyard-*?v&h=index,docs.count,store.size&s=index"
echo ""
echo "Done."
