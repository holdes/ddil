# SEC Findings: Airgapped Setup (run on the kit)

How to stand up the **SEC Findings** adventure on the DDIL kit. Everything runs
inside the case: Elasticsearch 9.5.6 and Kibana 9.5.6, Jina Embeddings v5 Omni
and NVIDIA Nemotron 3.5 Lightning on the DGX Spark. No cloud service, no internet.

The frontend deck (the 8-chapter SEC deck) and the backend `finance` router are
already wired into the app. This guide builds the **data and Kibana objects** the
deck queries and points the backend at the kit's models.

## What runs where

| Piece             | On the kit                                                                 |
|-------------------|----------------------------------------------------------------------------|
| Query embedding   | Jina Embeddings v5 Omni (`jina-embeddings-v5-omni-small`), `:8081` on the Spark, `EMBED_BACKEND=jina` |
| Corpus embedding  | Same model, same endpoint, same dims (`reembed-local.py --backend jina`)   |
| `sec_10k_2026`    | ES GPU node on the Spark, `SEC_EMBED_DIMS` (768) cosine HNSW               |
| Agent LLM         | Nemotron 3.5 Lightning 30B-A3B via vLLM on the Spark (`http://vllm.ddil:8000`, port: confirm on kit), through the Kibana connector `finance-ollama-llm` |
| Fallback LLM      | Previous Ollama connector, id `finance-ollama-fallback` (`FALLBACK=ollama`) |
| Kibana space      | kit Kibana on the Framework, `default` space                               |
| Fallback embedder | Ollama `/api/embed` (`EMBED_BACKEND=ollama`); the index must then be re-embedded with that model |

## Dimension: one value, sourced from config

The committed `sec_10k_2026` corpus carries **1536-d** vectors from an earlier
connected build. Jina v5 Omni on the kit is served at **768-d**, the same size as
the kit's `jina-omni-text` ES inference endpoint. The index **must be re-embedded
with Jina v5 Omni on the kit before the demo.**

- `demo/backend/app/config.py` `SEC_EMBED_DIMS = 768` is the single source.
- `run-all.sh` reads that value and passes it to `reembed-local.py --dims` and
  `setup-index-local.sh` (`DIMS`).
- The backend sends the same `dimensions` on every query embed and labels the
  vector in the "show the call" body with it.
- `reembed-local.py` stops if the server returns a different size.

Status: **STAGED, confirm on kit.** Confirm the Jina server serves v5 Omni at
768 (`GET :8081/health`, then one `POST /v1/embeddings` with `"dimensions": 768`).

## Prerequisites

1. **Cluster up.** ES GPU node on `192.168.1.20:9200`, Kibana on `192.168.1.10:5601`,
   all on 9.5.6.
2. **Jina Embeddings v5 Omni server** on the Spark, `:8081`
   (see `demo/scripts/jina/JINA-SETUP.md`).
3. **vLLM serving Nemotron 3.5 Lightning** on the Spark. The kit resolves
   `vllm.ddil` to `192.168.1.20` (compose `extra_hosts`). The port defaults to
   8000, vLLM's default: confirm on kit. Check the served model id:
   ```
   curl -s http://vllm.ddil:8000/v1/models | python3 -m json.tool
   ```
   The connector script uses the first id it returns unless `MODEL` is set.
   Agent Builder needs tool calling through the connector. Confirm on kit.
4. **Pre-show: apply the guidance-backend fix.** Open bug (GTC-DC-DEMO.md
   item 8): the Lightning Agent Builder hang comes from the vLLM xgrammar FSM.
   The fix is staged, not applied. Restart vLLM with the guidance
   structured-output backend:
   ```
   --guided-decoding-backend guidance
   ```
   The exact flag name depends on the installed vLLM version: confirm on kit.
   Newer vLLM releases take it through `--structured-outputs-config` or the
   `guided_decoding_backend` setting. Keep the previous Ollama connector as a
   fallback: run the connector script with `FALLBACK=ollama` to create it under
   the id `finance-ollama-fallback`.
5. **Corpus text on the kit**, e.g. `/data/sec/sec_10k_bulk.ndjson` (staged
   with `demo/scripts/data-transfer/`). Only the `text` field is used; the old
   1536-d `emb` is dropped and replaced.

## Run it

One shot:
```bash
cd demo/scripts/finance
EP="<elastic-password>" SRC=/data/sec/sec_10k_bulk.ndjson bash run-all.sh
# optional: VLLM=http://vllm.ddil:8000 MODEL=<served id> FALLBACK=ollama
```

Or step by step:
```bash
# 1. Re-embed on the kit with Jina v5 Omni (768-d)
python3 reembed-local.py --src /data/sec/sec_10k_bulk.ndjson --out ./sec_10k_local.ndjson \
        --backend jina --jina http://192.168.1.20:8081 \
        --model jina-embeddings-v5-omni-small --dims 768

# 2. Create + bulk-load the 768-d index on the GPU node
DIMS=768 ES_URL=http://192.168.1.20:9200 bash setup-index-local.sh ./sec_10k_local.ndjson

# 3. Kibana connector to Nemotron 3.5 Lightning on the Spark's vLLM
#    (model id from /v1/models; FALLBACK=ollama adds finance-ollama-fallback)
EP="<pw>" VLLM=http://vllm.ddil:8000 bash provision-connector-local.sh

# 4. Agent Builder finance.* tools + finance-analyst agent
EP="<pw>" bash provision-agent-local.sh

# 5. Kibana data view + overview dashboard (the deck's "In Kibana" buttons)
EP="<pw>" bash provision-kibana-local.sh
```

If ES security is on, also export `ES_USER`/`ES_PASSWORD` for steps 1 and 2.
Step 2 drops and recreates only `sec_10k_2026`. Never run `docker compose down -v`.

## Point the backend at the kit

The backend container reads its `environment` block in `demo/docker-compose.yml`,
which sets `VINEYARD_EMBED_BACKEND=jina`, `VINEYARD_JINA_OMNI_URL`,
`VINEYARD_SEC_EMBED_DIMS`, `VINEYARD_SEC_AGENT_LLM_MODEL`, `VINEYARD_LLM_BACKEND=vllm`
and `VINEYARD_VLLM_URL`. For a run outside
compose, copy `demo/backend/.env.airgapped` to `demo/backend/.env`. Set
`VINEYARD_AGENT_BUILDER_CONNECTOR_ID` to the id from step 3
(default `finance-ollama-llm`) and restart the backend.

Verify:
```bash
curl -s localhost:8000/api/finance/agent/state | python3 -m json.tool
# expect embed_backend=jina, embed_model=jina-embeddings-v5-omni-small,
#        llm_model=nemotron-3.5-lightning, es_url=...:9200, kibana_url=...:5601
```

## Smoke test

```bash
# kNN search (Chapter 03); embed_dims must be 768
curl -s localhost:8000/api/finance/search -H 'Content-Type: application/json' \
     -d '{"query":"AI model risk and governance","size":5}' | python3 -m json.tool
# sectors (filter chips)
curl -s localhost:8000/api/finance/sectors | python3 -m json.tool
```

Then in the app: **SEC Findings → Chapter 03** (semantic search) and
**Chapter 04** (agent chat). `Esc` exits to the chooser.

## Notes

- **Embedding consistency:** documents and queries go through the same Jina
  endpoint, model and dims with raw text. If you switch to the Ollama fallback,
  re-embed the corpus with `--backend ollama` and rebuild the index.
- **No quoted numbers:** recall and latency on the kit are not measured yet.
  Use the live `took_ms` the deck shows.
- **Agent tool calling:** if Agent Builder errors on tool calls, confirm the
  connector model (the id from `GET /v1/models`), that the vLLM
  OpenAI-compatible endpoint (`/v1/chat/completions`) is reachable from Kibana,
  and that the guidance-backend fix is applied. If the agent still hangs, set
  `VINEYARD_AGENT_BUILDER_CONNECTOR_ID=finance-ollama-fallback`.
