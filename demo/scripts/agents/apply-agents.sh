#!/usr/bin/env bash
# Provision the Choose-Your-Adventure Agent Builder agents + their ES|QL tools from
# the committed JSON in ./defs. Makes the agents reproducible instead of hand-built
# orphans in Kibana (the vineyard-advisor agent + 5 tools previously had NO
# provisioning script and nothing called them — see DEMO-AUDIT.md).
#
#   EP="<elastic-password>" bash apply-agents.sh
#   KB defaults to http://192.168.1.10:5601
#
# Covers: vineyard-advisor (+5 tools), research-assistant (+research.search_papers).
# The SEC finance-analyst agent + finance.* tools are provisioned by
# ../finance/provision-agent-local.sh (kept there; same pattern).
#
# NOTE ON THE LLM CONNECTOR: these agents do TOOL-CALLING, which requires a
# tool-calling-capable model. Use the **Qwen3** (Ollama) gen-ai connector —
# Nemotron Lightning (vLLM) emits a tool-call token format Agent Builder does NOT
# parse (raw <|tool_use_start|> markup leaks into the answer). The connector is
# passed at converse time by the backend (connector_id), not baked into the agent.
set -euo pipefail
KB="${KB:-http://192.168.1.10:5601}"
EP="${EP:?set EP to the elastic user password}"
H=(-u "elastic:$EP" -H 'Content-Type: application/json' -H 'kbn-xsrf: true' -H 'x-elastic-internal-origin: kibana')
DIR="$(cd "$(dirname "$0")" && pwd)/defs"

apply() {  # $1 = api subpath (tools|agents), $2 = json file
  local kind="$1" file="$2"
  local id; id=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['id'])" "$file")
  curl -sS "${H[@]}" -X DELETE "$KB/api/agent_builder/$kind/$id" >/dev/null 2>&1 || true
  curl -sS "${H[@]}" -X POST "$KB/api/agent_builder/$kind" --data-binary @"$file" \
    | python3 -c "import json,sys;d=json.load(sys.stdin);print(f'  {sys.argv[1]:7} {sys.argv[2]:30}', 'ERROR '+str(d.get('statusCode'))+' '+str(d.get('message',''))[:120] if d.get('statusCode') else 'ok')" "$kind" "$id"
}

# The tool-calling LLM connector the agents converse through. Qwen3 via Ollama with
# enableNativeFunctionCalling — Nemotron Lightning (vLLM) is NOT usable here (its
# tool-call token format leaks into answers). Stable id so the backend can reference it.
VLLM_QWEN_URL="${QWEN_URL:-http://192.168.1.20:11434/v1/chat/completions}"
QWEN_MODEL="${QWEN_MODEL:-qwen3:30b-a3b-instruct-2507-q4_K_M}"
echo "== connector ddil-agent-qwen3 =="
curl -sS "${H[@]}" -X DELETE "$KB/api/actions/connector/ddil-agent-qwen3" >/dev/null 2>&1 || true
curl -sS "${H[@]}" -X POST "$KB/api/actions/connector/ddil-agent-qwen3" -d "{
  \"name\":\"DDIL Agent LLM (Qwen3 — tool-calling)\",
  \"connector_type_id\":\".gen-ai\",
  \"config\":{\"apiProvider\":\"Other\",\"apiUrl\":\"$VLLM_QWEN_URL\",\"defaultModel\":\"$QWEN_MODEL\",\"verificationMode\":\"full\",\"enableNativeFunctionCalling\":true},
  \"secrets\":{\"apiKey\":\"ollama\"}
}" | python3 -c "import json,sys;d=json.load(sys.stdin);print('  connector:', d.get('id','ERR'), d.get('message','') if d.get('statusCode') else 'ok')"

# Delete the agents first so their tools are no longer referenced (a referenced
# tool can't be deleted), making the tool re-create below idempotent.
echo "== unlink agents =="
for f in "$DIR"/agent.*.json; do
  id=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['id'])" "$f")
  curl -sS "${H[@]}" -X DELETE "$KB/api/agent_builder/agents/$id" >/dev/null 2>&1 || true
  echo "  - $id"
done
echo "== tools =="
for f in "$DIR"/tool.*.json; do apply tools "$f"; done
echo "== agents =="
for f in "$DIR"/agent.*.json; do apply agents "$f"; done
echo "Done. Verify: curl -sS ${H[*]@Q} '$KB/api/agent_builder/agents' | python3 -m json.tool"
