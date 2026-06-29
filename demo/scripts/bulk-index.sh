#!/bin/bash
# ============================================================
# Bulk index JSONL files into Elasticsearch
# Usage: ./bulk-index.sh <ES_URL> <INDEX_NAME> <JSONL_FILE> [BATCH_SIZE]
# ============================================================
set -euo pipefail

ES_URL="${1:?Usage: $0 <ES_URL> <INDEX_NAME> <JSONL_FILE> [BATCH_SIZE]}"
INDEX="${2:?Usage: $0 <ES_URL> <INDEX_NAME> <JSONL_FILE> [BATCH_SIZE]}"
JSONL="${3:?Usage: $0 <ES_URL> <INDEX_NAME> <JSONL_FILE> [BATCH_SIZE]}"
BATCH_SIZE="${4:-500}"

if [ ! -f "$JSONL" ]; then
  echo "File not found: $JSONL"
  exit 1
fi

TOTAL=$(wc -l < "$JSONL")
echo "Indexing $TOTAL documents into $INDEX @ $ES_URL (batch size: $BATCH_SIZE)"

INDEXED=0
BATCH=""
BATCH_COUNT=0

while IFS= read -r line; do
  BATCH="${BATCH}{\"index\":{}}\n${line}\n"
  BATCH_COUNT=$((BATCH_COUNT + 1))

  if [ "$BATCH_COUNT" -ge "$BATCH_SIZE" ]; then
    RESPONSE=$(printf "$BATCH" | curl -s -X POST "$ES_URL/$INDEX/_bulk" \
      -H "Content-Type: application/x-ndjson" \
      --data-binary @-)
    ERRORS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('errors',False))" 2>/dev/null || echo "unknown")
    INDEXED=$((INDEXED + BATCH_COUNT))
    if [ "$ERRORS" = "True" ]; then
      echo "  WARNING: Errors in batch at doc $INDEXED"
    fi
    printf "\r  %d / %d (%.0f%%)" "$INDEXED" "$TOTAL" "$(echo "$INDEXED * 100 / $TOTAL" | bc)"
    BATCH=""
    BATCH_COUNT=0
  fi
done < "$JSONL"

# Flush remaining
if [ "$BATCH_COUNT" -gt 0 ]; then
  printf "$BATCH" | curl -s -X POST "$ES_URL/$INDEX/_bulk" \
    -H "Content-Type: application/x-ndjson" \
    --data-binary @- > /dev/null
  INDEXED=$((INDEXED + BATCH_COUNT))
fi

echo ""
echo "Done: $INDEXED documents indexed into $INDEX"

# Refresh index
curl -s -X POST "$ES_URL/$INDEX/_refresh" > /dev/null
COUNT=$(curl -s "$ES_URL/$INDEX/_count" | python3 -c "import sys,json; print(json.load(sys.stdin)['count'])")
echo "Verified: $COUNT documents in $INDEX"
