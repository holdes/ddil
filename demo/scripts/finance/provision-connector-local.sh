#!/usr/bin/env bash
# provision-connector-local.sh — create a Kibana gen-ai connector that points at
# the kit's LOCAL LLM: NVIDIA Nemotron 3.5 Lightning 30B-A3B served by vLLM on
# the DGX Spark, through vLLM's OpenAI-compatible API. Agent Builder uses it to
# run the finance-analyst agent (Chapter 04). Nothing leaves the kit.
#
# vLLM port: default 8000 (vLLM's default). Confirm on kit.
# Model id:  discovered from GET $VLLM/v1/models (first id) unless MODEL is set.
#
# Pre-show: the Lightning Agent Builder hang (xgrammar FSM) needs vLLM started
# with the guidance structured-output backend. See SEC-AIRGAP-SETUP.md.
#
# Usage:
#   EP="<elastic-password>" bash provision-connector-local.sh
#   EP="<elastic-password>" FALLBACK=ollama bash provision-connector-local.sh
#
# FALLBACK=ollama also creates the previous Ollama connector under the id
# finance-ollama-fallback (Ollama OpenAI-compatible API on the Spark), so the
# agent can be switched to it if vLLM misbehaves.
#
# Then copy the printed connector id into demo/backend/.env as
#   VINEYARD_AGENT_BUILDER_CONNECTOR_ID=...
set -euo pipefail

KB="${KB:-http://192.168.1.10:5601}"                       # local Kibana (Framework), default space
EP="${EP:?set EP to the elastic user password}"
KU="${KU:-elastic}"
CONNECTOR_ID="${CONNECTOR_ID:-finance-ollama-llm}"          # id kept for compose compatibility
VLLM="${VLLM:-http://vllm.ddil:8000}"                       # DGX Spark vLLM (port: confirm on kit)
VLLM_KEY="${VLLM_KEY:-vllm}"                                # any non-empty value unless vLLM runs with --api-key
MODEL="${MODEL:-}"
FALLBACK="${FALLBACK:-}"
FALLBACK_ID="${FALLBACK_ID:-finance-ollama-fallback}"
OLLAMA="${OLLAMA:-http://192.168.1.20:11434}"               # DGX Spark Ollama (fallback only)
OLLAMA_MODEL="${OLLAMA_MODEL:-nemotron-3.5-lightning}"
H=(-u "$KU:$EP" -H 'Content-Type: application/json' -H 'kbn-xsrf: true')

if [ -z "$MODEL" ]; then
  echo "==> discovering served model from $VLLM/v1/models"
  MODEL="$(curl -sS -m 10 -H "Authorization: Bearer $VLLM_KEY" "$VLLM/v1/models" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print((d.get('data') or [{}])[0].get('id',''))" || true)"
  if [ -z "$MODEL" ]; then
    echo "  error: no model id from $VLLM/v1/models. Is vLLM up? Set VLLM=... or MODEL=..." >&2
    exit 1
  fi
  echo "  served model: $MODEL"
fi

create_connector() {
  # $1 id, $2 name, $3 apiUrl, $4 model, $5 apiKey
  echo "==> creating gen-ai connector '$1' → $3 ($4)"
  # delete-if-exists for idempotency, then create with a fixed id
  curl -sS "${H[@]}" -X DELETE "$KB/api/actions/connector/$1" >/dev/null 2>&1 || true
  curl -sS "${H[@]}" -X POST "$KB/api/actions/connector/$1" -d @- <<JSON | python3 -c "import json,sys; d=json.load(sys.stdin); print('  connector:', d.get('id'), '·', d.get('name')) if d.get('id') else print('  error:', d)"
{
  "name": "$2",
  "connector_type_id": ".gen-ai",
  "config": {
    "apiProvider": "Other",
    "apiUrl": "$3",
    "defaultModel": "$4"
  },
  "secrets": {
    "apiKey": "$5"
  }
}
JSON
}

create_connector "$CONNECTOR_ID" "Local vLLM (${MODEL})" "${VLLM}/v1/chat/completions" "$MODEL" "$VLLM_KEY"

if [ "$FALLBACK" = "ollama" ]; then
  create_connector "$FALLBACK_ID" "Local Ollama fallback (${OLLAMA_MODEL})" "${OLLAMA}/v1/chat/completions" "$OLLAMA_MODEL" "ollama"
fi

echo
echo "Set in demo/backend/.env:"
echo "  VINEYARD_AGENT_BUILDER_CONNECTOR_ID=$CONNECTOR_ID"
if [ "$FALLBACK" = "ollama" ]; then
  echo "Fallback (switch to it only if vLLM misbehaves):"
  echo "  VINEYARD_AGENT_BUILDER_CONNECTOR_ID=$FALLBACK_ID"
fi
