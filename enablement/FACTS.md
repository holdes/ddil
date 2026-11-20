# DDIL Demo Kit: SA Enablement Fact Base

Source of truth for SA enablement. Built from code at commit `5114c3a` (branch `sa-enablement`), plus a read-only look at the uncommitted tree in `/Users/bholden/Desktop/ddil` (marked LOCAL WIP).

Rules used here:
- Every fact cites `path:line`. Paths are relative to the repo root.
- Numeric tags:
  - **MEASURED** means the value is computed at runtime from real ES data or a real query.
  - **STAGED** means the value is hardcoded or simulated in code.
  - **DOC-ONLY** means the value appears only in docs or comments, never in executed code.
- "NOT FOUND" means I searched and found nothing.
- No secret values are copied. Placeholders only.

---

## 0. Showcase target (13 Nov 2026)

**Status: STAGED until verified on the kit.** This section records what the kit will showcase. It is a target, not a description of the committed code. Every other section of this file still cites the code at `5114c3a`, and those citations stand until the kit config changes and is re-verified. Presentation and training surfaces (decks, mock, guides, quick reference, chooser) present this target. Runbook 02 pages 13 and 14 carry the change steps; pages 15 and 16 carry the cutover load order.

### 0.1 Showcase model lineup (target, 13 Nov 2026)

| Role | Showcase model | Where it runs | Source of the name and facts |
|---|---|---|---|
| LLM | **NVIDIA Nemotron 3.5 Lightning 30B-A3B** (NVIDIA NeMo family). Served model id: from `GET /v1/models` (confirm on kit); config label `nemotron-3.5-lightning` | vLLM on the DGX Spark, `http://vllm.ddil:8000` (port is vLLM's default: confirm on kit). Ollama stays on `:11434` for Vineyard search embeddings and the fallback connector | NVIDIA developer blog "Nemotron 3.5 Lightning delivers fast, accurate specialized task execution for long-running agents"; NVIDIA blog "nemotron-lightning-switchyard-rtx-dgx"; ollama.com/library/nemotron-3.5-lightning |
| Embeddings | **Jina Embeddings v5 Omni**, `jina-embeddings-v5-omni-small`, text and images in one vector space. Jina is part of Elastic. | Jina server on the DGX Spark, `:8081` | Name already requested by the code: `config.py:65`, `setup-indices-local.sh:16`; JINA-SETUP.md prerequisite 1 (`JINA_MODEL_ID=jinaai/jina-embeddings-v5-omni-small`) |

Facts allowed on slides and docs (architecture and licence only, per NVIDIA's own description): open-weight; mixture-of-experts, about 30B parameters with about 3B active; hybrid Mamba-2 and attention; built for long-running agentic workloads; licence OpenMDW-1.1, commercial use permitted. **Do not quote** NVIDIA speed or benchmark claims (multipliers, percentages, index scores). No measurement of this model on the kit exists.

Jina Embeddings v5 Omni replaces `nomic-embed-text` everywhere, including Vineyard Search and SEC semantic search. The kit no longer presents `gpt-oss:120b`, `nomic-embed-text`, `jina-embeddings-v4`, `llama3.x` or the bench embedder and LLM as kit models.

What must change on the kit to match (change from the committed value, cited in 1.6, 1.8 and 3.4):

| # | Item | Committed value | Target | Status |
|---|---|---|---|---|
| M1 | LLM server on the Spark | `gpt-oss:120b` and `nomic-embed-text` in Ollama; no repo script pulls them (5.1) | vLLM serving Nemotron 3.5 Lightning (already running per the kit owner; GTC-DC-DEMO.md item 8). Pre-show: restart with the guidance structured-output backend (`--guided-decoding-backend guidance`; flag name for the installed version: confirm on kit) to clear the xgrammar Agent Builder hang | runtime, confirm on kit |
| M2 | Backend LLM | Ollama `/api/chat`, `gpt-oss:120b` | Done in code (20 Nov): `LLM_BACKEND=vllm` default, `VLLM_URL=http://vllm.ddil:8000`, `LLM_MODEL=nemotron-3.5-lightning` used if `/v1/models` lists it, else the first served id, cached (`config.py`, `services/llm.py`). `rag.py` goes through `services/llm.py`. `reasoning_content` ignored. `ollama` keeps the old path. Compose and `.env.airgapped` set `VINEYARD_LLM_BACKEND=vllm`, `VINEYARD_VLLM_URL` | code done; runtime confirm on kit |
| M3 | Agent Builder connector `finance-ollama-llm` | Ollama `/v1/chat/completions`, "Local Ollama (${MODEL})" | Done in code (20 Nov): `provision-connector-local.sh` points at `${VLLM:-http://vllm.ddil:8000}/v1/chat/completions`, model from `/v1/models` unless `MODEL` is set, name "Local vLLM (model)", id unchanged. `FALLBACK=ollama` adds `finance-ollama-fallback` on Ollama. Tool calling through the connector: confirm on kit | code done; run on kit |
| M4 | Pipeline completion label | hardcoded `"model": "gpt-oss:120b"` in `job_complete` (`routers/chat.py:182`) | Done (20 Nov): `model_label()` (resolved vLLM id, else `LLM_MODEL`). Progress text names Nemotron 3.5 Lightning (vLLM) | code done |
| M5 | Jina server | `serve_jina_v4.py`, `MODEL_ID` default `jinaai/jina-embeddings-v4` (`serve_jina_v4.py:36`); echoes the caller's model name (C14) | Serve `jinaai/jina-embeddings-v5-omni-small`. Whether `serve_jina_v4.py` with `JINA_MODEL_ID` set can load v5 Omni (`AutoModel`, `encode_text`/`encode_image`, `task`, `prompt_name`), or a separate omni-small server is used (C34, cu128 build for Blackwell per JINA-SETUP.md): **confirm on kit**. Verify with `GET :8081/health`, which returns `model` (`serve_jina_v4.py:128-130`) | STAGED, confirm on kit |
| M6 | ES inference endpoint `jina-omni-text` | already `model_id: jina-embeddings-v5-omni-small`, 768-d (`setup-indices-local.sh:23-35`) | No change to the definition | matches target |
| M7 | Jina indices | vectors embedded by the v4 server | Re-run `setup-indices-local.sh` (deletes and recreates both indices, `:49,63`), `ingest-multimodal.py`, `ingest-pmc.py` after M5 | STAGED |
| M8 | SEC and Vineyard query embedding | `EMBED_BACKEND` default `bedrock` (`config.py:38`); `.env.airgapped:6-7` sets `ollama` / `nomic-embed-text`; `services/embedder.py:6-25` calls Ollama `/api/embed` | Query embedding through Jina v5 Omni on `:8081`. The committed embedder speaks only Ollama `/api/embed`, which the Jina server does not serve, so a code change is needed (an OpenAI-shape `/v1/embeddings` path). Variable names and values: **confirm on kit** | STAGED, code change |
| M9 | SEC corpus | re-embedded with `nomic-embed-text` via Ollama (`reembed-local.py:50,114`; `run-all.sh:17,22`); index 768-d cosine (`setup-index-local.sh:16-17`) | Re-embed with Jina v5 Omni at `dimensions: 768`, rebuild with `DIMS=768`. `reembed-local.py` calls Ollama `/api/embed`; it needs the same change as M8. Command: **confirm on kit** | STAGED, code change |
| M10 | Vineyard Search semantic and hybrid | 768-d query against the 8-d `reading_vector` falls back to mock (F4, C9) | Same failure with a Jina query vector; the target lineup does not fix F4 | unchanged |
| M11 | Kit UI labels that print a model name | `SystemOverview.tsx:94,105`; `Architecture.tsx:117-119,137`; kiosk `health.ts:31-32`, `BrandingPage.tsx:9-10,93`; SEC `AgentConfigCard.tsx:37-38,46`, `Chapter02_5_Elastic.tsx`, show-the-call body `finance.py:150-156` | Done (20 Nov, display text only): Vineyard Architecture, SystemOverview, RaceIntro, RAGChat; kiosk health labels and Branding ticker and pill; SEC Chapter 00, AgentConfigCard, EconomicsPanel, Chapter 05 say vLLM and Elasticsearch 9.5.6. Kept on purpose: CCS stat "nomic, on Spark" (`CcsApp.tsx:96`, CCS collect still embeds with nomic); SEC show-the-call Ollama label when `EMBED_BACKEND=ollama` (`finance.py:40`) | code done |
| M12 | Vineyard text search embeddings | `services/search.py:16,26` call `services/embedder.embed_text` (Ollama `/api/embed`, `EMBED_MODEL=nomic-embed-text`) and kNN on `vineyard-soil.reading_vector` (8-d, already mismatched, M10). CCS collect (`routers/ccs.py:224`) uses the same function into `field-reports` (`CCS_EMBED_DIMS=768`) | Jina Embeddings v5 Omni. Needs a re-embed of the Vineyard index (and of `field-reports` for CCS) plus a switch of `embed_text` to the Jina path. Not done in this pass | OPEN |
| M13 | Kiosk live health checks | `health.ts` LLM and embeddings checks probe `ollama.ddil:11434/api/tags`; `MOCK = true` | Probe vLLM `/v1/models` and Jina `:8081/health`. Labels changed only. Set `MOCK = false` on the kit after the backend is up (runbook 02 page 16, step 10) | OPEN, confirm on kit |
| M14 | Need-to-Know corpus denominator | `/ 509 docs` and "509 research papers" (`NeedToKnow.tsx:50,74`) | Done (20 Nov): `CORPUS_DOCS = 198` in `NeedToKnow.tsx` (the API returns only the analyst-visible count). CLAUDE.md, GTC-DC-DEMO.md, JINA-SETUP.md say 198 | code done |

Verify on the kit (runbook 02 pages 14 to 16): `GET vllm.ddil:8000/v1/models` lists the Nemotron model; `:8081/health` names `jina-embeddings-v5-omni-small`; `/api/finance/agent/state` reports `llm_model` `nemotron-3.5-lightning` (`finance.py:201`); the Kibana connector reports `apiUrl` on `vllm.ddil` and `defaultModel` equal to the `/v1/models` id.

### 0.2 Elastic Stack 9.5.6 (target, 13 Nov 2026)

The kit showcases Elasticsearch 9.5.6 on both nodes (es-gpu and es-cpu) and Kibana 9.5.6, with one security configuration. The cuVS GPU indexing story stays. No 9.5 feature claims are made beyond what the kit already shows.

| # | Item | Committed value (1.4, 1.5) | Target | Status |
|---|---|---|---|---|
| V1 | es-gpu image | `FROM elasticsearch:9.4.2` (`docker/es-gpu/Dockerfile:1`; unchanged on 20 Nov) | `FROM docker.elastic.co/elasticsearch/elasticsearch:9.5.6` | STAGED |
| V2 | aarch64 cuVS Java jar | `cuvs-java-25.12.0.jar` copied into `modules/gpu` (`docker/es-gpu/Dockerfile:6`); native libs bind-mounted from the `cuvs-build` conda env (`docker/docker-compose.yml:47`) | An aarch64 build of the cuVS Java jar matching the jar in the 9.5.6 image's `modules/gpu`, with matching native libs. Jar version and build source: **confirm on kit** (`docker run --rm --entrypoint ls elasticsearch:9.5.6 /usr/share/elasticsearch/modules/gpu`) | STAGED, confirm on kit |
| V3 | es-cpu image | `elasticsearch:9.3.1` at `5114c3a`; `9.4.2` in the merged compose on 20 Nov (`demo/docker-compose.yml:20`, maps server `:84` too) | `elasticsearch:9.5.6` | STAGED |
| V4 | Kibana image | `kibana:9.3.1` at `5114c3a`; `9.4.2` in the merged compose on 20 Nov (`demo/docker-compose.yml:62`) | `kibana:9.5.6` | STAGED |
| V5 | Security and TLS | es-gpu security on, transport TLS (`docker/docker-compose.yml:28-35`); es-cpu security off, no TLS (`demo/docker-compose.yml:23-24`); Kibana with no ES credentials | Same security and transport TLS settings on es-cpu as on es-gpu, same p12 mounted on the Framework (host path: **confirm on kit**); Kibana with `kibana_system` credentials | STAGED |
| V6 | Data | indices built on 9.3 and 9.4 | Readable on 9.5. Any migration beyond restarting on the new images: **confirm on kit**. Never `docker compose down -v` | STAGED |

Verify (runbook 02 page 13): `GET /` on both nodes reports `9.5.6`; `_cat/nodes` lists `spark-gpu` and `framework-cpu` on 9.5.6; Kibana `/api/status` reports 9.5.6.

Pre-show check carried on every surface: **all nodes and Kibana on 9.5.6, security settings matched, and the kit config pointing at Nemotron 3.5 Lightning and Jina v5 Omni.**

### 0.3 SEC Findings airgapped cutover (working tree on `sa-enablement`, 13 Nov 2026, uncommitted)

The SEC adventure no longer shows, calls or prices a cloud service. These are code changes in the working tree, not in `5114c3a`. The "Committed value" column is the change-from citation at `5114c3a`; sections 1.6, 1.8, 3.1 to 3.5 still describe that committed code. Items M3, M8, M9 and the SEC part of M11 are carried by this table.

| # | Item | Committed value (change from) | Working tree (change to) | Status |
|---|---|---|---|---|
| S1 | Chapter 00 "The Hardware Face-Off" | AWS g6.8xlarge vs g6.4xlarge (NVIDIA L4) with us-east-2 hourly prices, ES 9.4.2, 1536-d (`Chapter00_Architecture.tsx:76-151`, `lib/pricing.ts:13-29`) | The kit's two nodes: Framework Desktop (Ryzen AI Max+ 395, 64 GB, es-cpu `framework-cpu`, heap 8g) vs DGX Spark (GB10, 128 GB, es-gpu `spark-gpu`, heap 16g), both `:9200`, ES 9.5.6, 768-d. Delta ribbon: "Inside the case · no cloud account, no internet, no per-hour bill". No prices (`Chapter00_Architecture.tsx:71-165`) | STAGED (static text; 9.5.6 per 0.2) |
| S2 | Chapter 01 headline row and GPU popup | "AWS cost · this job" and "TCO ↓" computed from staged race (`Chapter01_Speed.tsx:182-194`); popup "Per-job AWS savings" (`GpuFinishedPopup.tsx:22,141-149`) | "Runs on: The kit" and "Cloud bill · this job: None"; popup "Built on: DGX Spark", "Cloud bill: None". Race labels name the kit nodes. Speedups still come from the staged race (`Chapter01_Speed.tsx:182-187`, `GpuFinishedPopup.tsx:129-135`) | STAGED |
| S3 | Chapter 02 economics | `EconomicsPanel` AWS per-job cost + 89.4 % enterprise TCO (`EconomicsPanel.tsx:28,93-97`) | Kit economics: two race durations plus three statements (inference on the kit, embeddings on the kit, nothing leaves the case). No dollar figures (`EconomicsPanel.tsx:14-50`) | STAGED (durations from the staged race) |
| S4 | Elastic segue, data pipeline, one-index diagram | "89% TCO reduction"; "embedded with Bedrock Cohere Embed v4"; pipeline "Bedrock Cohere v4 · 1536-d", "759 MB"; agent spoke "Bedrock Opus" | Jina Embeddings v5 Omni 768-d on the DGX Spark; ES 9.5.6 cosine HNSW; agent spoke "Nemotron 3.5 Lightning"; no TCO figure (`Chapter02_5_Elastic.tsx`, `DataPipeline.tsx`, `OneIndexFourConsumers.tsx`) | STAGED |
| S5 | Chapter 04 config card, Tradeoffs, comparison table | LLM sub "Bedrock"; "1536-d"; "Bedrock connector"; Bedrock $/M pricing, "Bedrock spend", annual savings projection; agent row "Elastic agent + Bedrock", "$0.15-$1.20" (`AgentConfigCard.tsx:37-46`, `TradeoffPanel.tsx:10-36,92`, `TraditionalComparison.tsx:92-114`) | LLM "vLLM on the DGX Spark · via Kibana connector" (was Ollama until 20 Nov); embedder "Jina v5 Omni on the DGX Spark · 768-d"; "vLLM connector · local Nemotron model"; Tradeoffs shows time, round-trips, tokens and "Cloud spend: None"; agent row "Elastic agent on the kit", "No per-query bill", time from this run only | STAGED (labels); time and tokens MEASURED per run |
| S6 | Chapter 05 recap | "g6.4xlarge L4 vs g6.8xlarge EPYC", "24× … 16.6× … 106×", "70-100 ms", "Sonnet 4.6 … 26 → 3 LLM calls" (`Chapter05_Conclusion.tsx:19-29`) | Kit nodes, ES 9.5.6; GPU build vs CPU build with no multiplier; Nemotron 3.5 Lightning on the Spark | STAGED |
| S7 | Show the call | `query_vector` label "<1536-d embedding from Cohere Embed v4 via Bedrock>" (`finance.py:150-156`); cURL default host `localhost:9200` | "<768-d embedding from Jina Embeddings v5 Omni (jina-embeddings-v5-omni-small) on the DGX Spark>" (`finance.py:37-42,124`); default host `http://es.ddil:9200` (`ShowTheCall.tsx:19`), else `es_url` from `/api/finance/agent/state` | code change |
| S8 | Query embedder | `EMBED_BACKEND` default `bedrock`; boto3 Bedrock client (`config.py:38,56-59`, `finance.py:28-71`) | `EMBED_BACKEND` default `jina` (`config.py:39`), `ollama` fallback. `services/embedder.py:41-63` posts `{JINA_OMNI_URL}/v1/embeddings` with `{model, input, dimensions}` and reads `data[i].embedding`. AWS_PROFILE, AWS_REGION and BEDROCK_* removed from `config.py`; boto3 removed from `requirements.txt` | code change; tested against a local stub only |
| S9 | `/api/finance/agent/state` values | `llm_model` Bedrock id when `bedrock`; `embed_backend` `bedrock` | Same field names. `llm_model` = `SEC_AGENT_LLM_MODEL` `nemotron-3.5-lightning` (`config.py:47`, `finance.py:171`); `embed_model` `jina-embeddings-v5-omni-small`; `embed_backend` `jina` | code change |
| S10 | One SEC dimension | index 768 (`setup-index-local.sh:16`) vs backend unspecified; committed corpus 1536-d | `SEC_EMBED_DIMS = 768` (`config.py:44`). `run-all.sh:21-22` reads it and passes it to `reembed-local.py --dims` and `setup-index-local.sh` `DIMS`; `reembed-local.py:170` stops on a mismatch. 768 matches `jina-omni-text` (M6) | STAGED, confirm on kit |
| S11 | SEC corpus re-embed | Ollama `/api/embed`, `nomic-embed-text` (`reembed-local.py:50,114`) | `reembed-local.py --backend jina` (default) posts `/v1/embeddings` with `dimensions` (`reembed-local.py:52-86,129-136`). **The index must be re-embedded with Jina v5 Omni on the kit before the demo** | STAGED, confirm on kit |
| S12 | Connector | `MODEL` default `gpt-oss:120b`, name "Local Ollama (gpt-oss)" | vLLM `/v1/chat/completions`, model from `/v1/models`, name "Local vLLM (model)", optional `finance-ollama-fallback` (see M3). Tool calling through the connector: confirm on kit | code done; confirm on kit |
| S13 | Backend container env | no embed backend set | `VINEYARD_EMBED_BACKEND=jina`, `VINEYARD_JINA_OMNI_URL=http://jina.ddil:8081`, `VINEYARD_SEC_EMBED_DIMS=768`, `VINEYARD_SEC_AGENT_LLM_MODEL=nemotron-3.5-lightning`, and since 20 Nov `VINEYARD_LLM_BACKEND=vllm`, `VINEYARD_VLLM_URL=http://vllm.ddil:8000` (`demo/docker-compose.yml`); mirrored in `.env.airgapped` | code change |

Not changed: the Chapter 01 presenter panel still cites 78 % TCO ("Elastic + NVIDIA Webinar 2026", `presenter/WhyItMatters.tsx:15`) and the enterprise cost-model scale projection (`presenter/ScaleProjection.tsx`, `lib/pricing.ts`). Neither is a cloud price; neither is measured on the kit. Vineyard search and CCS collect still embed through Ollama `/api/embed` (`services/embedder.py:19-38`).

Verify on the kit: `GET :8081/health` names `jina-embeddings-v5-omni-small`; one `POST :8081/v1/embeddings` with `"dimensions": 768` returns 768 floats; `GET sec_10k_2026/_mapping` shows `emb` dims 768; `/api/finance/agent/state` reports `embed_backend` `jina` and `llm_model` `nemotron-3.5-lightning`; Chapter 03 returns hits.


### 0.4 Cutover pass (20 Nov 2026, branch `sa-enablement` after the merge of `holdes/master` e864f53)

Code is done for M2, M3, M4, M11, M14 and S12. Everything below still needs the kit.

Confirm on kit:
- vLLM port (default 8000, `VLLM_URL`, `provision-connector-local.sh` `VLLM`) and the served model id (`GET /v1/models`).
- The guidance structured-output flag name for the installed vLLM version, applied before the show (GTC-DC-DEMO.md item 8: the xgrammar hang fix is staged, not applied).
- Agent Builder tool calling through `finance-ollama-llm` on vLLM. Fallback connector: `finance-ollama-fallback` (`FALLBACK=ollama`).
- Nemotron may spend part of the token budget on reasoning. The Need-to-Know analyst answer caps `max_tokens` at 900 (`routers/jina.py`); check that answers are not cut short.
- `vllm.ddil` resolution inside the backend container (`extra_hosts`) and on the host for `.env.airgapped` runs.

Open (not in this pass): M12 Vineyard search and CCS collect embeddings; M13 kiosk health endpoints; V1, V3, V4 images still pin 9.4.2; the cuVS jar for 9.5.6 (V2).

---

## 1. Kit hardware and network

### 1.1 Nodes and addresses

| Item | Value | Source |
|---|---|---|
| DGX Spark | 192.168.1.20, GB10 Blackwell, 128 GB unified, aarch64 | `docker/docker-compose.yml:1,24`; UI `demo/frontend/src/components/Architecture/Architecture.tsx:105-114` |
| Framework Desktop | 192.168.1.10, Ryzen AI Max+ 395, 64 GB, x86_64 | `demo/docker-compose.yml:1,22`; `Architecture.tsx:125-134` |
| Gateway | UniFi Express 7 at 192.168.1.1 | `Architecture.tsx:156-157` (UI); `05-NETWORK-CONFIG.md` (DOC-ONLY) |
| Switch | Switch Flex Mini, 5-port GbE | `Architecture.tsx` (lines ~160-165); `SystemOverview.tsx` hardware strip |
| DHCP pool | 192.168.1.100-199 | `NETWORK-DIAGRAM.md`, `05-NETWORK-CONFIG.md` (DOC-ONLY) |
| "<1.2ms latency", "1 Gbps Cat6a" | STAGED UI text | `Architecture.tsx` network strip (~lines 165-170) |

### 1.2 Friendly .ddil DNS names (commit 5114c3a)

These are mapped in the backend container through `extra_hosts` (`demo/docker-compose.yml:76-85`). The commit message says they also come from UniFi local DNS and host `/etc/hosts` on spark and framework (`git show 5114c3a`). Neither is in the repo.

| Name | IP | Used by code? |
|---|---|---|
| spark.ddil | 192.168.1.20 | `config.py:18` DGX_SPARK_HOST (no code reads DGX_SPARK_HOST beyond config) |
| es.ddil | 192.168.1.20 | `config.py:7` ES_GPU_URL, `demo/docker-compose.yml:68` |
| jina.ddil | 192.168.1.20 | `config.py:64` JINA_OMNI_URL |
| ollama.ddil | 192.168.1.20 | `config.py:21-22`, `demo/docker-compose.yml:70-71` |
| vllm.ddil | 192.168.1.20 | extra_hosts only. No code references vLLM (NOT FOUND) |
| relay.ddil | 192.168.1.20 | extra_hosts only. No code reference (NOT FOUND) |
| framework.ddil | 192.168.1.10 | kiosk `demo/kiosk/src/lib/health.ts` es-cpu check |
| kibana.ddil | 192.168.1.10 | `config.py:47` KIBANA_URL |
| gw.ddil | 192.168.1.1 | extra_hosts only |

- ES transport (discovery/publish) intentionally stays on raw IPs. Sources: commit message 5114c3a, `docker/docker-compose.yml:22-24`, `demo/docker-compose.yml:20-22`.
- Commit 5114c3a says the demo app was not running when it was committed. The .ddil wiring is **unverified on the box**.
- `.env.airgapped` still uses raw IPs, not .ddil names (`demo/backend/.env.airgapped:8,12,15,23,32,45`).

### 1.3 Compose services and ports

| Host | Service | Image / build | Ports | Key settings | Source |
|---|---|---|---|---|---|
| Spark | es-gpu | build `docker/es-gpu` FROM `elasticsearch:9.4.2` + aarch64 `cuvs-java-25.12.0.jar` | 9200, 9300 | node `spark-gpu`, `node.attr.accel=gpu`, `vectors.indexing.use_gpu=true`, heap 16g, security ON, no `ml` role | `docker/docker-compose.yml:9-47`, `docker/es-gpu/Dockerfile:1,6` |
| Framework | es-cpu | `elasticsearch:9.3.1` | 9200, 9300 | node `framework-cpu`, `accel=cpu`, `use_gpu=false`, heap 8g, **`xpack.security.enabled=false`** | `demo/docker-compose.yml:13-30` |
| Framework | kibana | `kibana:9.3.1` | 5601 | `ELASTICSEARCH_HOSTS=http://es-cpu:9200`, hardcoded encryption keys (values not copied), **no ES username/password** | `demo/docker-compose.yml:44-55` |
| Framework | backend | build `demo/backend` (python:3.12-slim, uvicorn) | 8000 | env only sets ES/Ollama/DATA_DIR. **No ES_USER/ES_PASSWORD, no env_file**. Mounts `./data/preprocessed:/data:ro` and `./data/tiles:/tiles:ro` | `demo/docker-compose.yml:62-93`, `demo/backend/Dockerfile` |
| Framework | frontend | build `demo/frontend` (node:22, **Vite dev server**, not a prod build) | 3000 | proxies `/api`, `/tiles`, `/ws` to `backend:8000` | `demo/docker-compose.yml:97-105`, `demo/frontend/Dockerfile`, `demo/frontend/vite.config.ts:7-23` |
| Spark | Ollama (native, systemd) | n/a | 11434 | not in compose | `config.py:21-22`; CLAUDE.md (DOC-ONLY) |
| Spark | Jina embed server (native) | `serve_jina_v4.py` | 8081 | see 1.6 | `demo/scripts/jina/serve_jina_v4.py:136-140` |
| Framework | kiosk | static server | 3100 | `MOCK = true` by default | `demo/kiosk/src/lib/health.ts:37`; CLAUDE.md |

Cluster: one cluster named `ddil-vineyard` (`docker/docker-compose.yml:14`, `demo/docker-compose.yml:17`), seeded at each other's `:9300`, `cluster.initial_master_nodes=spark-gpu,framework-cpu`.

### 1.4 ES version actually pinned

| Component | Version | Source |
|---|---|---|
| es-gpu | **9.4.2** | `docker/es-gpu/Dockerfile:1` (changed 9.3.1→9.4.2 in 46ca60f) |
| es-cpu | **9.3.1** | `demo/docker-compose.yml:14` |
| kibana | **9.3.1** | `demo/docker-compose.yml:45` |
| backend ES client | `elasticsearch[async]==8.17.0` | `demo/backend/requirements.txt` |
| UI strings | "9.4.2" everywhere | `AdventureChooser.tsx:206`, `RaceIntro.tsx:143`, `Architecture.tsx:117,137` ("9.4.2 stock" for the CPU node), SEC `Chapter00_Architecture.tsx:57` |

### 1.5 Security and auth state after 46ca60f

- es-gpu has `xpack.security.enabled=true`, API keys force-enabled, HTTP plaintext, and transport TLS mandatory with `certs/elastic-certificates.p12` (`docker/docker-compose.yml:28-35`).
  - Bootstrap password comes from `${ELASTIC_PASSWORD}` (`docker/docker-compose.yml:36`).
  - Placeholder `ELASTIC_PASSWORD=change-me` is in `docker/.env.example:5`.
  - Cert is bind-mounted from `/home/blakester205/ddil/docker/certs/` (`docker/docker-compose.yml:46`). Certs are gitignored (`.gitignore` "docker/certs/", "*.p12").
- The ML role was removed from the ARM node so that x86-only ELSER can allocate on the Framework (`docker/docker-compose.yml:17-21`).
- es-cpu still has `xpack.security.enabled=false` and no transport TLS (`demo/docker-compose.yml:23-24`). **As committed, the two nodes have incompatible security config.** See Conflicts C1.
- The backend adds basic auth only when both `VINEYARD_ES_USER` and `VINEYARD_ES_PASSWORD` are set (`demo/backend/app/services/elasticsearch.py:9-13`, `routers/finance.py:79-83`, `routers/jina.py:33-36`). Compose does not set them (`demo/docker-compose.yml:66-72`).
- Kibana calls from the backend send basic auth only if `KIBANA_USER/PASSWORD` are set (`finance.py:86-89`). A comment claims "Kibana security… ours is off" (`finance.py:230`).
- `.env` placement:
  - `.env` is gitignored (`.gitignore`) and excluded from the backend image (`demo/backend/.dockerignore:4`).
  - Pydantic reads `env_file=".env"` from the CWD (`config.py:128-131`).
  - Result: **inside the compose container, `.env` is never read**. It only takes effect when the backend runs natively via `demo/backend/run.sh:3`.
- The frontend has no auth. CORS is `*` (`demo/backend/app/main.py:25-31`).
- Agent Builder, Kibana, and ES provisioning scripts use `-u elastic:$EP` (`demo/scripts/finance/provision-agent-local.sh:20-21`, `provision-connector-local.sh:17-22`, `demo/scripts/jina/setup-indices-local.sh:18-21`).
  - `demo/scripts/setup-indices.sh` and `bulk-index-synthetic.sh` send **no auth** (`setup-indices.sh:19,24`, `bulk-index-synthetic.sh:30,40`).

### 1.6 Models served

| Model | Served by | Used by | Source |
|---|---|---|---|
| `gpt-oss:120b` | Ollama `/api/chat` on 11434 | vineyard 5-phase pipeline, RAG chat, Jina analyst answer | `config.py:24`, `services/llm.py:21-32`, `services/rag.py:43-50`, `routers/jina.py:319` |
| `gpt-oss:120b` via Kibana `.gen-ai` connector `finance-ollama-llm` → `${OLLAMA}/v1/chat/completions` | Kibana Agent Builder | SEC finance-analyst agent | `demo/scripts/finance/provision-connector-local.sh:19-38` |
| `nomic-embed-text` (768-d) | Ollama `/api/embed` | vineyard Search (semantic/hybrid), SEC query embed when `EMBED_BACKEND=ollama`, SEC corpus re-embed | `config.py:23`, `services/embedder.py:6-14`, `finance.py:65-66`, `reembed-local.py` |
| `jinaai/jina-embeddings-v4` (native 2048-d, Matryoshka-truncated, default 1024) | `serve_jina_v4.py` FastAPI on `0.0.0.0:8081`, CUDA fp16 | Jina adventure (both indices + query embed) | `serve_jina_v4.py:36-41,69,100-131,136-140` |
| Bedrock Cohere Embed v4 (1536-d), Bedrock Claude Sonnet 4.6 | AWS (bench only) | SEC when `EMBED_BACKEND=bedrock` (the **default**) | `config.py:38,56-59`, `finance.py:34-56` |

- Jina server contract:
  - Request: `POST /v1/embeddings {input:[str|{type:"image_base64",...}], dimensions?}`. Response is OpenAI shape.
  - `GET /health` (`serve_jina_v4.py:100-131`).
  - Accepted truncate dims: 128, 256, 512, 1024, 2048. Other dims (e.g. 768) are generated larger, then truncated and renormalized (`:69-76`).
  - Images smaller than 28 px are upscaled (`:85-95`).
  - Text uses `prompt_name="passage"` by default **for queries too** (`:39,81`).
- The Jina server echoes back whatever `model` the caller sent (`serve_jina_v4.py:125`). Callers send `jina-embeddings-v5-omni-small` (`config.py:65`). See Conflicts C14.
- Ollama Jina v4 GGUF (`hf.co/jinaai/jina-embeddings-v4-text-retrieval-GGUF:Q8_0`, 2048-d) is **DOC-ONLY** (CLAUDE.md "Ollama" section; UI `Architecture.tsx:119`). No code pulls or uses it.
- `llama3.1:70b` appears only in stale UI and docs (`SystemOverview.tsx:105`, `TROUBLESHOOTING.md:174`, `09-AI-INFERENCE.md:80`). The kiosk was corrected in 5114c3a.

### 1.7 ES inference endpoints

| Endpoint | Definition | Source |
|---|---|---|
| `text_embedding/jina-omni-text` | `service: openai`, `url: ${OMNI}/v1/embeddings`, `model_id: jina-embeddings-v5-omni-small`, `dimensions: 768`, dummy api_key | `demo/scripts/jina/setup-indices-local.sh:23-35` |
| ingest pipeline `jina-embed-caption` | inference processor caption → caption_vector | `setup-indices-local.sh:37-46` |
| `ollama-embeddings`, `ollama-chat` | **DOC-ONLY** (CLAUDE.md "Inference Endpoints"). No script creates them | NOT FOUND in code |
| `ddil-embeddings`, `ddil-llm` | **DOC-ONLY** | `09-AI-INFERENCE.md:205,221` |

### 1.8 Env vars that matter (prefix `VINEYARD_`, `config.py:129`)

| Var | Default | Notes | Source |
|---|---|---|---|
| ES_MAIN_URL | `http://es-cpu:9200` | used as CPU client | `config.py:6,115-119` |
| ES_GPU_URL | `http://es.ddil:9200` | all vineyard, SEC, and Jina queries go here | `config.py:7,109-113` |
| ES_GPU_HOST / ES_GPU_PORT | None / 9200 | HOST wins over URL | `config.py:12-13,111-112` |
| ES_CPU_HOST / ES_CPU_PORT | None / **9201** | | `config.py:14-15` |
| ES_USER / ES_PASSWORD | None | must be set now that security is on | `config.py:43-44` |
| OLLAMA_EMBED_URL / OLLAMA_LLM_URL | `http://ollama.ddil:11434` | | `config.py:21-22` |
| EMBED_MODEL / LLM_MODEL | `nomic-embed-text` / `gpt-oss:120b` | | `config.py:23-24` |
| EMBED_BACKEND | **`bedrock`** | must be `ollama` on the kit | `config.py:38`; `.env.airgapped:6` |
| SEC_INDEX | `sec_10k_2026` | | `config.py:40` |
| KIBANA_URL / KIBANA_SPACE | `http://kibana.ddil:5601` / `default` | | `config.py:47-48` |
| KIBANA_USER / KIBANA_PASSWORD | None | | `config.py:49-50` |
| AGENT_BUILDER_AGENT_ID | `finance-analyst` | | `config.py:51` |
| AGENT_BUILDER_CONNECTOR_ID | None | `.env.airgapped` sets `finance-ollama-llm` | `config.py:52`, `.env.airgapped:29` |
| JINA_OMNI_URL / JINA_OMNI_MODEL | `http://jina.ddil:8081` / `jina-embeddings-v5-omni-small` | | `config.py:64-65` |
| JINA_MM_INDEX / INFERENCE_ID / DIMS | `jina-multimodal` / `jina-omni-text` / 768 | | `config.py:68-70` |
| JINA_DLS_INDEX / DIMS | `pmc-unstructured` / 1024 | | `config.py:72-73` |
| JINA_FIG_DIR / PDF_DIR / IMG_DIR | `/data/jina/extracted_imgs`, `/data/jina/samples`, `/data/jina/images` | `.env.airgapped` uses `/data/jina/scale/...` | `config.py:75-77`, `.env.airgapped:37-39` |
| RACE_BATCH_SIZE / RACE_METRICS_INTERVAL_MS | 500 / 500 | batch size is unused by the staged race | `config.py:30-31`, `routers/race.py:30` |
| AWS_REGION / BEDROCK_* | us-east-2, `us.cohere.embed-v4:0`, `us.anthropic.claude-sonnet-4-6` | bench only | `config.py:56-59` |

`.env.airgapped` holds placeholders only: commented `VINEYARD_ES_PASSWORD`, `VINEYARD_KIBANA_PASSWORD`, `VINEYARD_ECH_API_KEY`, and `<...>` CCS hosts (`demo/backend/.env.airgapped:19-20,25-26,47-50`). The Kibana encryption keys in `demo/docker-compose.yml:51-53` are hardcoded literals. They are not copied here.

---

## 2. Adventure 1: Vineyard Intelligence

### 2.1 Click path (confirmed in `demo/frontend/src/App.tsx`)

1. **AdventureChooser** → "Vineyard Intelligence" card (`App.tsx:126-134`, `AdventureChooser.tsx:39-76`).
2. **Architecture** (shown first for vineyard only, `App.tsx:131,153-161`). "Continue" button → step 3.
3. **RaceIntro** (`App.tsx:165-174`). "Start the Race" button (`RaceIntro.tsx:153-158`) → step 4.
4. **RaceDashboard** with `autoStart` (`App.tsx:178-183`). Auto-POSTs `/api/race/start` on mount (`RaceDashboard.tsx:136-142`). The button reads "Skip →" while running and "Continue to Demo →" when complete (`RaceDashboard.tsx:178-185`).
5. **Main app with sidebar** (`App.tsx:63-71`). Sidebar order: **Dashboard → Vineyard → AI Agronomist → Search → Crop Health → Indexing Race → System**. Default scene is `dashboard` (`App.tsx:88`).

Navigation notes:
- The sidebar is the free navigation. Nothing auto-advances inside the main app.
- `investigateBlock(id, q?)` sets the block, sets a pending query, and jumps to the chat scene (`App.tsx:107-115`). The default query is `Analyze the current status of block ${blockId} and recommend actions` (`App.tsx:110`).
- The sidebar shows "Investigate {block} →" when a block is selected (`App.tsx:235-242`).
- "Indexing Race" in the sidebar re-renders RaceDashboard **without** autoStart or Continue (`App.tsx:79`).

### 2.2 Screens

| Screen | Shows | API | Live vs staged |
|---|---|---|---|
| Architecture | two node cards, network strip, data flow "User Query 'Why is Block C failing?' → Agent Builder → ES\|QL + kNN '841K vectors searched' → GPT-OSS 120B → Actionable Insights", stat strip "869K Documents Indexed / 2 nodes / 120B / 12x GPU Index Speedup / <50 lbs" | none | all STAGED (`Architecture.tsx:105-140, 190-235, 243-247`) |
| RaceIntro | datasets Soil 841,536 (8-dim), Disease Imagery 17K (2048-dim), NPK 10K (7-dim), Harvest & Wine 281; "~28,500 v/s" vs "~2,400 v/s"; "12x faster" | none | STAGED (`RaceIntro.tsx:14-20, 99, 108, 119, 128`) |
| RaceDashboard | CPU card "CPU HNSW (Port 9201)" and GPU card "GPU HNSW — cuVS (Port 9200)"; progress, throughput, merge ms, util %, elapsed; mid-race explainer ("12x faster", "98.9% recall"); summary ribbon | `POST /api/race/start`, `WS /api/race/status`, `POST /api/race/reset` | STAGED simulation (see 2.3) |
| Dashboard | estate name, KPIs (avg moisture, avg soil temp, total records, active alerts), mini map, 6 block cards, 4 alerts, 5 Quick Investigate buttons | `GET /api/vineyard/config`, `GET /api/vineyard/dashboard` | KPIs MEASURED if ES answers. **Silent STAGED fallback** if `block_summaries` is empty or the fetch fails (`Dashboard.tsx:174-206`). Alerts always STAGED (`Dashboard.tsx:50-79`) |
| VineyardMap | Leaflet with offline tiles `/tiles/{z}/{x}/{y}.png`, block polygons, color modes Health/Moisture/Temp/K Level, detail panel (soil, NPK, story), "Investigate with AI" | `GET /api/vineyard/config`, `GET /api/vineyard/blocks/{id}/summary` ×6 | MEASURED per block. **Per-block STAGED fallback** `MOCK_SUMMARIES` if moisture is null or the call errors (`VineyardMap.tsx:57-63, 110-127, 150-153, 357`) |
| AI Agronomist | 5-phase pipeline UI, suggested queries, Recent Investigations (localStorage) | `POST /api/chat/agent/stream` (SSE) | ES and LLM live, with mock fallbacks (see 2.4) |
| Search | BM25 / Semantic / Hybrid (RRF) toggle, latency | `POST /api/search` | Hybrid and Semantic **always fail and fall back to STAGED mock** (see Conflicts C9). Latency `embed: 12` is STAGED (`routers/search.py:36`) |
| Crop Health | image upload → classification | `POST /api/images/search` | **100% STAGED**: backend returns a fixed "Black Rot 0.942, 847 similar, blocks B3/B7/C2" (`routers/images.py:6-27`); frontend has the same mock (`LeafScanner.tsx:33-49`). Subtitle "15K+ grape disease embeddings · kNN on CLIP vectors" (`LeafScanner.tsx:59`) |
| System | stat cards 1 PFLOP / 615K+ (GPU ~22s / CPU ~150s) / <50ms / Zero; node cards | none | **100% STAGED and stale** (`SystemOverview.tsx:67-106`) |

### 2.3 The race: exactly how the numbers are produced

- **No path wired to the UI does real indexing.**
  - `run_race` accepts `index_name`/`data_file` but never touches ES (`demo/backend/app/services/indexer.py:79-93`).
  - The module docstring says "staged ... 50K vector corpus" (`indexer.py:1-8`), but `TOTAL_DOCS = 841536` (`indexer.py:18`).
- GPU: `target_throughput=28500`, `merge_time_ms=48`, `total_seconds=15`. CPU: `4200`, `340`, `55` (`indexer.py:86-91`).
- Progress: `docs_indexed` rises linearly, `TOTAL_DOCS/steps` every 0.5 s (`indexer.py:32-45`). **Displayed throughput during the run is a separate fiction**: `target × ramp × gauss(1, 0.05)` (`indexer.py:39-47`). Merge ms gets ±20% noise (`indexer.py:50-51`).
- Resource figures are STAGED:
  - GPU util 65±8 %, CPU 25±5 %, mem 12.4 GB.
  - CPU path 85±6 %, GPU 0, mem 6.2 GB.
  - Source: `indexer.py:54-61`.
- At completion, throughput is recomputed as `TOTAL_DOCS/elapsed` (`indexer.py:75`). That gives about **56,100 v/s GPU** and **15,300 v/s CPU**, not 28,500/4,200 (derived arithmetic: 841,536/15 and 841,536/55).
- Summary math (`demo/backend/app/services/metrics.py:73-93`):
  - `speedup = cpu_elapsed/gpu_elapsed` ≈ **3.7×**.
  - `forceMergeSpeedup = 340/48` ≈ **7.1×**.
  - `timeSaved` ≈ 40 s.
  - `recallGpu: 98.9`, `recallCpu: 98.7` hardcoded with comment "Will be computed post-race" (`metrics.py:90-91`).
- RaceDashboard "Total Vectors Indexed" = gpu + cpu = **1,683,072** (`RaceDashboard.tsx:310`), which double-counts.
- The CPU card shows the label "GPU Util 0%" because `gpuPercent` is 0, not undefined (`RaceDashboard.tsx:86-91`, `indexer.py:60`).
- WebSocket: the server pushes every 500 ms and closes after `complete` (`routers/race.py:19-32`). The vineyard client auto-reconnects every 3 s (`hooks/useWebSocket.ts:13,37-41`).
- Real-indexing artifacts that exist but are **not wired to the UI**:
  - `demo/scripts/race.sh` is a CLI that times `_forcemerge?max_num_segments=1` on `vineyard-imagery` at `192.168.1.20:9200` and `192.168.1.10:9200` in parallel (`race.sh:7-9,40-45`). Under the one-cluster topology both URLs reach the **same index in the same cluster**, and it sends no auth.
  - `race-soil|npk|imagery-{gpu,cpu}` allocation-filtered indices are created by `demo/scripts/setup-indices.sh:125,145-154` but never written by any code (NOT FOUND).

### 2.4 Agent pipeline (5 phases)

Endpoint: `POST /api/chat/agent/stream` (`routers/chat.py:40-200`). **All 5 phases are direct Python. None call Agent Builder.** No vineyard code references Kibana or Agent Builder (grep: only `config.py` KIBANA_* and `finance.py`). `services/phases/pipeline.py` is an unused alternate orchestrator (`run_pipeline` is never imported).

| # | Phase id / UI name | What runs | LLM? | Source |
|---|---|---|---|---|
| 0 | `sensors` / Sensor Snapshot | latest `vineyard-soil` + `vineyard-npk` doc for `block_id` (or `match_all` if none) on the **GPU client**; health rule moisture<25 alert, >45 watch, K<100 alert | no | `phases/phase0_sensors.py:19-84`; mock fallback BLK-C 46.2 % / K 50 (`:107-118`) |
| 1 | `historical` / Historical Context | builds an 8-dim query vector (moisture/temp from sensor; EC, depth, hour, day-of-year **constants**) → kNN k=5, num_candidates=100 on `reading_vector`, filtered to block → LLM JSON | yes | `phase1_historical.py:34-95`; mock hits 2020 BLK-B, 2022 BLK-C (`:128-150`) |
| 2 | `risk` / Risk Analysis | LLM JSON from sensor summary + historical summary + question; heartbeats every 3 s | yes | `phase2_risk.py:25-56`, `chat.py:104-128` |
| 3 | `recommendation` / Crop Recommendation | LLM JSON, variety from a hardcoded block→variety map | yes | `phase3_recommendation.py`, `chat.py:95-101,133-156` |
| 4 | `action_plan` / Action Plan | LLM JSON tasks, assignee, deadline, cost | yes | `phase4_action_plan.py`, `chat.py:161-177` |

- Phases 2-4 are **sequential**. The SSE text claims "in parallel" (`chat.py:42,91`).
- LLM call: Ollama `/api/chat`, non-stream, `num_predict 4000`, temp 0.1, **timeout 120 s per call** (`services/llm.py:12-30`). There are 4 sequential LLM calls.
- The system prompt bakes in the estate story and the claim "841K soil readings, 10K NPK, 17K imagery" (`phases/prompts.py:3-20`).
- **Typed questions and suggested chips send no `block_id`** (`AgentChat.tsx:345-351`). Phase 0 then uses the latest doc across all blocks. Only Dashboard, Map, and sidebar "Investigate" pass a block (`AgentChat.tsx:314-321`).
- Final `job_complete` sends `model: "gpt-oss:120b"`, `phases_completed: 5` as hardcoded strings (`chat.py:179-185`).

### 2.5 Agent Builder agent and tools (vineyard)

- `vineyard-advisor` agent and tools `vineyard-sensor-snapshot`, `vineyard-npk-profile`, `vineyard-npk-trend`, `vineyard-harvest-history`, `vineyard-disease-scan`: **DOC-ONLY** (CLAUDE.md "Elastic Agent Builder"). **No provisioning script or code reference found (NOT FOUND).**
- UI claims that contradict this: chooser "AI Agronomist · Elastic Agent Builder" (`AdventureChooser.tsx:70`) and Architecture data-flow "Agent Builder" (`Architecture.tsx` data-flow box).

### 2.6 Fictional estate

Domaine de la Côte Cachée, Walla Walla AVA, WA. Center 46.0150, -118.3800, zoom 16 (`routers/vineyard.py:8-13`).

| Block | Name | Variety | Acres | Elev m | Aspect | Soil | Story | Source |
|---|---|---|---|---|---|---|---|---|
| BLK-A | Les Pierres | Cabernet Sauvignon | 4.2 | 285 | S | Loess over basalt | star performer | `vineyard.py:15-30` |
| BLK-B | Clos du Vent | Syrah | 3.8 | 310 | SW | Shallow rocky | wind-exposed, drought-vulnerable | `:31-46` |
| BLK-C | La Rivière | Merlot | 5.1 | 245 | E | Alluvial clay | declining since 2022 | `:47-62` |
| BLK-D | Le Jardin | Chardonnay | 3.5 | 260 | NE | Sandy loam | disease-prone in wet years | `:63-78` |
| BLK-E | Vieilles Vignes | Cabernet Franc | 2.8 | 295 | S | Volcanic, deep | 35-yr vines, consistent | `:79-94` |
| BLK-F | Le Plateau | Riesling | 2.2 | 320 | N | Limestone-rich | highest, cool | `:95-110` |

Acre sum is 21.6 (UI says "22 acres", `AdventureChooser.tsx:55`).

Baked-in stories in the generator (STAGED data model):
- Years 2018-2025, seed 42 (`demo/datagen/config.py:22-23`).
- 2020 summer drought, 60 % less precip (`config.py:154-155`). 2020 April frost (`:158`). 2022 events (`:160`).
- BLK-C drainage failure starts **2022-06-15**, drainage drops to 35 % (`config.py:169-174`).
- K depletion with a 50 mg/kg floor from base 210 (`demo/datagen/npk.py:66-71`, `config.py:73`).
- Vintage profiles: 2020 quality_base 8, 2022 quality_base 6 (`config.py:184,186`).

Dashboard alerts (STAGED, `Dashboard.tsx:50-79`):

| Severity | Block | Title |
|---|---|---|
| critical | BLK-C | Potassium Depletion (K 210→50 since mid-2022) |
| warning | BLK-C | Persistent High Moisture (15 % above normal for 18 months) |
| warning | BLK-D | Disease Risk Elevated (2022 mildew pattern) |
| info | BLK-B | Drought Watch |

The "Active Alerts" KPI shows 3 (non-info), "1 critical" (`Dashboard.tsx:252-257`).

### 2.7 Indices and counts

| Index | Count | Tag | Dims | Source |
|---|---|---|---|---|
| vineyard-soil | 841,536 | STAGED (race constant, dashboard fallback) / DOC-ONLY (CLAUDE.md) | `reading_vector` 8, cosine | `indexer.py:18`, `Dashboard.tsx:188`, `setup-indices.sh:50`, `models/es_mappings.py:17-21` |
| vineyard-npk | 10,032 | STAGED fallback | `npk_vector` 7 | `Dashboard.tsx:189`, `setup-indices.sh:67` |
| vineyard-imagery | 17,151 | STAGED fallback | `image_embedding` **768** in mapping (UI and docs say 2048) | `Dashboard.tsx:190`, `setup-indices.sh:82`, `es_mappings.py:71` |
| vineyard-harvest | 175 | STAGED fallback | none | `Dashboard.tsx:191` |
| vineyard-wine | 106 | STAGED fallback | none | `Dashboard.tsx:192` |
| total | 869,000 (exact sum of the five) | STAGED fallback; MEASURED via `_count` when ES works | | `Dashboard.tsx:186`, `routers/vineyard.py:262-273` |

- `bulk-index-synthetic.sh` loads wine, harvest, npk, and soil only. **Imagery is not loaded by it** (`bulk-index-synthetic.sh:56-59`).
- The datagen generator has no imagery step (`demo/datagen/generate.py:46-87`).

### 2.8 Suggested prompts in the UI (exact)

Dashboard "Quick Investigate" (`Dashboard.tsx:425-429`):
- "Why is Block C underperforming?"
- "Compare the 2020 and 2022 vintages"
- "Which blocks need attention this week?"
- "What caused the potassium cliff in La Rivière?"
- "Show me the best performing block and explain why"

AI Agronomist chips (`AgentChat.tsx:37-44`):
- "Why is La Rivière (BLK-C) underperforming since 2022?"
- "Why was the 2020 Clos du Vent Syrah our best wine despite the drought?"
- "Which blocks are at risk for disease this season?"
- "What's happening with potassium levels in Block C?"
- "Compare Block E (Vieilles Vignes) consistency across all vintages"
- "What should I prioritize this week across the estate?"

Other text:
- Chat input placeholder: "Ask about soil, irrigation, disease risk, crop management..." (`AgentChat.tsx:561`).
- Search placeholder: "blocks showing drought stress similar to 2012 conditions" (`SearchPlayground.tsx:95`).

### 2.9 Reset behaviour

- Sidebar "Reset Demo" clears adventure, arch/intro/race flags, scene, block, pending query, and `localStorage["vineyard-conversations"]` (`App.tsx:92-101,243-249`). It returns to the chooser.
- It does **not** call `/api/race/reset`. The server race state persists until the next `/start` (which reinitializes, `indexer.py:82`) or a manual Reset in RaceDashboard (`useRaceMetrics.ts:65-69`).
- Conversation cache: max 20, Recent Investigations shows 8 (`AgentChat.tsx:285,298,436`).

---

## 3. Adventure 2: SEC Findings

Entry: chooser card → `SecDeck` (`App.tsx:138-140`). The SEC adventure skips Architecture and RaceIntro. **The RaceIntro "sec" branch (counts "TBD") is unreachable** (`RaceIntro.tsx:22-33`).

### 3.1 Chapters in order (`demo/frontend/src/components/sec/SecDeck.tsx:14-23`)

| # | Chip | Title / content | Interactive | Live vs canned |
|---|---|---|---|---|
| 00 | Setup | "The Hardware Face-Off": AWS **g6.8xlarge (CPU, 32 vCPU, 128 GB, $2.014/hr)** vs **g6.4xlarge (NVIDIA L4, 16 vCPU, 64 GB, $1.323/hr)**, each with ES 9.4.2 config tables (dims 1536, heap 31g/30g, single-node), but labelled with kit IPs `192.168.1.10:9201` / `192.168.1.20:9200` | none | STAGED (`Chapter00_Architecture.tsx:76-151`, `lib/pricing.ts:21-29`) |
| 01 | Speed | "Indexing Speed" race UI ("live, real-time race … CAGRA"). Start/Reset; GPU-finished popup; PresenterPanel (WhyItMatters / UseCases / ScaleProjection, auto-rotate 15 s); headline speedups, AWS job cost, TCO %, recall | Start Race, Reset, popup, presenter tabs, scale sliders | **Same staged `/api/race` simulator as vineyard (841,536 docs)** (`Chapter01_Speed.tsx:84,111-117,144-199`; `hooks/useRaceMetrics.ts:42-74`). Hardware labels "g6.8xlarge… port 9201" / "g6.4xlarge · NVIDIA L4 · port 9200" (`Chapter01_Speed.tsx:148,156`) |
| 02 | Side-by-Side | tabs Throughput (recharts of race history) / E2e Workflow / Architecture (cuVS stack, "Bundled in Elasticsearch 9.4 OSS"); EconomicsPanel below | tabs, Assumptions toggle | chart from staged race; Economics see 3.4 (`Chapter02_SideBySide.tsx:14-108`) |
| — | Elastic | segue: pillars (cites "89% TCO reduction"), platform stack, "one index four consumers", SEC data pipeline ("embedded with Bedrock Cohere Embed v4 … bulk-loaded into the GPU-built index from chapter 01") | none | canned (`Chapter02_5_Elastic.tsx:11-22,78-84`) |
| 03 | Interface | analyst search (left) + developer cURL/Python/Dev Tools (right), sector chips, Kibana buttons (Dev Tools, Discover `sec-10k-data-view`, Dashboard `sec-10k-overview`) | search box, 5 example queries, sector filter, code tabs, links | **LIVE**: `GET /api/finance/sectors`, `POST /api/finance/search` (`hooks/useFinanceSearch.ts:35,45-48`; `Chapter03_DataInterface.tsx:24-30`; `shared/finance/KibanaButtons.tsx:22-34`) |
| 04 | Agentic | Agent Builder chat with streaming reasoning/tool timeline, AgentConfigCard, TradeoffModal (cost/perf), "Open in Kibana" | textarea (⌘/Ctrl+Enter), 5 examples, reset, tradeoff modal | **LIVE** via `POST /api/finance/agent/chat` → Kibana `/api/agent_builder/converse/async` (`hooks/useAgentChat.ts:80`; `finance.py:209-260`). Config card mostly canned (see 3.5) |
| — | Workflows | "Daily 10-K AI-Risk Digest" YAML (rrule daily 09:00 UTC, `ai.agent` → finance-analyst, console log), "Open in Kibana" / "Trigger now" links to `/app/workflows/daily-10-k-ai-risk-digest` | 2 links | canned. **No script provisions this workflow (NOT FOUND)** (`Chapter04_5_Workflows.tsx:5-33,86-112`) |
| 05 | The Stack | recap cards + 3 links (Search Labs blog, github elastic/elasticsearch, build.nvidia.com) | links | canned (`Chapter05_Conclusion.tsx:18-31,115-133`) |

Keyboard:
- → / PageDown next, ← / PageUp prev, Esc exits to the chooser (`SecDeck.tsx:42-45`).
- Digits `0`-`5` jump to chapters 00-05. The two "—" segues are reachable only by arrows or chip click (`SecDeck.tsx:46-52`).
- Ch04 sends with ⌘/Ctrl+Enter (`Chapter04_AgenticAction.tsx:57`).

Example queries:
- Ch03 (`Chapter03_DataInterface.tsx:24-30`):
  - "AI model risk and governance disclosures"
  - "Commercial real estate exposure"
  - "Supply chain disruption risk in semiconductors"
  - "Climate-related transition risk"
  - "Cybersecurity incident response"
- Ch03 placeholder: "Search 503 S&P 500 10-K filings semantically…" (`:81`).
- Ch04 (`Chapter04_AgenticAction.tsx:12-18`):
  - "Compare AI risk disclosures across AAPL, MSFT, GOOGL and META — what do they agree on, where do they differ?"
  - "Which financial-sector filings flag commercial real estate exposure as a material risk?"
  - "What climate-transition risks does the Energy sector disclose in its 10-Ks?"
  - "Across the S&P 500, which sector has the most filings citing supply-chain disruption?"
  - "Show me three healthcare 10-Ks that talk about generative AI in clinical workflows."

### 3.2 Backend endpoints (`demo/backend/app/routers/finance.py`)

| Endpoint | Behaviour | Source |
|---|---|---|
| `GET /api/finance/sectors` | terms agg on `sector` (size 30) over SEC_INDEX on the GPU URL. No try/except, so it 500s if ES fails | `:171-182` |
| `POST /api/finance/search` | embeds the query (ollama or bedrock) → kNN on `emb`, k=size (default 8), num_candidates=max(10k,50), optional sector filter. Returns hits + request body. Embed failure → 502 | `:93-168` |
| `GET /api/finance/agent/state` | config summary (kibana_url, es_url, space, agent_id, connector_id, llm_model, embed_model, embed_backend, sec_index) | `:192-206` |
| `POST /api/finance/agent/chat` | streams raw SSE from `${kibana_space_url}/api/agent_builder/converse/async` with `{input, agent_id, connector_id, conversation_id?}`; **read timeout None** | `:209-260` |

The "show the call" body always says `"<1536-d embedding from Cohere Embed v4 via Bedrock>"`, even in ollama mode (`finance.py:150-156`).

### 3.3 Agent and tools (`demo/scripts/finance/provision-agent-local.sh`)

- Connector: `finance-ollama-llm`, `.gen-ai`, apiProvider Other → `${OLLAMA}/v1/chat/completions`, model `gpt-oss:120b` (`provision-connector-local.sh:19-38`).
- Tools are ES|QL and recreated by delete + POST (`provision-agent-local.sh:23-31`):

| Tool | Query (abridged) | Source |
|---|---|---|
| `finance.company_disclosures` | `FROM sec_10k_2026 METADATA _score \| WHERE ticker == ?ticker AND MATCH(text, ?topic) \| SORT _score DESC \| KEEP … \| LIMIT ?top_n` | `:33-46` |
| `finance.compare_companies` | `WHERE ticker IN (?t1..?t6) AND MATCH(text, ?topic) … LIMIT 60` | `:48-65` |
| `finance.sector_breakdown` | `WHERE MATCH(text, ?topic) \| STATS filings = COUNT_DISTINCT(accession) BY sector` | `:67-78` |

- Agent `finance-analyst` "Financial Filings Analyst" is created by DELETE then POST (comment: "PUT only updates in 9.4") (`:82-107`).
  - Instructions: max 6 tool calls, cite ticker + accession, and the data line "503 latest 10-K filings, 93,541 chunks" (`:90`, STAGED text).
  - Tools: 3 finance.* plus `platform.core.search`, `execute_esql`, `generate_esql`, `get_document_by_id`, `get_index_mapping`, `list_indices`, `index_explorer` (10 total) (`:92-103`).
  - `enable_elastic_capabilities: false`.
- Header claim "26 LLM calls · 600K tokens · 220s → 3 LLM calls · 120K · 77s" is **DOC-ONLY** (comment, `:13-15`).
- `provision-kibana-local.sh`: data view `sec-10k-data-view`, 4 Lens viz, dashboard `sec-10k-overview` (`:15-160`).
- `run-all.sh` runs 5 steps: re-embed → index → connector → agent → kibana (`run-all.sh:21-34`).

### 3.4 Index, dims, counts

| Item | Value | Tag | Source |
|---|---|---|---|
| index | `sec_10k_2026` | | `config.py:40` |
| kit dims | 768 cosine HNSW (`DIMS` default), `dynamic: false`, refresh -1 during load | | `setup-index-local.sh:15-17,34-53` |
| bench dims | 1536 (Cohere v4) | DOC/UI | `Chapter00_Architecture.tsx:98,122`, `AgentConfigCard.tsx:38` |
| filings | 503 | STAGED (UI + agent prompt) | `Chapter03_DataInterface.tsx:81`, `provision-agent-local.sh:90`, `TraditionalComparison.tsx:114` |
| chunks | 93,541 | STAGED | `provision-agent-local.sh:90`, `AgentConfigCard.tsx:39` |
| took_ms, hits, embed_dims | from the live query | MEASURED | `finance.py:157-167` |
| sector counts | live agg | MEASURED | `finance.py:181-182` |
| source corpus | `sec_10k_bulk.ndjson` (2.1 GB), staged via S3 presigned URLs | DOC-ONLY | CLAUDE.md "Dataset staging" |
| reembed | nomic-embed-text, batch 64, MAX_CHARS 8000, recursive split on failure, no retry on 400 | | `reembed-local.py:38,74-86,113-115` |

### 3.5 Economics and pricing (all STAGED assumptions)

| Number | Value | Source | Notes |
|---|---|---|---|
| AWS hourly | GPU g6.4xlarge $1.323, CPU g6.8xlarge $2.014 (us-east-2, "May 2026") | `lib/pricing.ts:13,21-24` | the kit is not AWS |
| Bedrock $/M tokens | Sonnet 4.6 3/15, Opus 4.6 15/75, Haiku 4.5 1/5 | `pricing.ts:16-20`, `TradeoffPanel.tsx:32-36` | gpt-oss on the kit gets priced as "Sonnet" (fallthrough) |
| Annual per-node | CPU $135,617 (15,760 + 4,957 + 114,900 + 0); GPU $148,417 (19,600 + 4,957 + 114,900 + NVAIE 8,960) | `pricing.ts:57-72` | "mirrors Cost Model for Elasticsearch GPUs.xlsx" (not in repo) |
| TCO defaults | 10 B vectors, 1024-d, 12 h SLA, CPU 17,919 v/s, GPU 185,600 v/s | `pricing.ts:75-81` | |
| EconomicsPanel TCO | locked to defaults → 12.92 vs 1.25 nodes, $1.75 M vs $185 k/yr, **89.4 %** reduction, ~$1.57 M saved | `EconomicsPanel.tsx:28,93-97` (derived arithmetic) | |
| Ch01 TCO headline | computed from **staged race throughput** (≈15.3 k / 56.1 k v/s) → **≈70 %** | `Chapter01_Speed.tsx:182,190-194` | contradicts the 89.4 % shown one chapter later |
| AWS job cost (Ch01/Ch02) | ≈ $0.0055 GPU vs $0.031 CPU from staged durations | `pricing.ts:39-50` | labelled "real for this run" (`EconomicsPanel.tsx:27`) |
| WhyItMatters | 175 ZB (IDC), 90 % unstructured (IDC), **78 % lower indexing TCO** ("Elastic + NVIDIA Webinar 2026"), 5-6× price-performance | `presenter/WhyItMatters.tsx:13-16` | DOC-ONLY citations |
| TradeoffPanel | typical $0.60/answer, "optimized" = ×0.60, QPD presets 100…100k; claims 21-39 %, 27-34 %, up to 40 % | `TradeoffPanel.tsx:10-11,23-26,45-48` | |
| TraditionalComparison | analyst $900 (6 h × $150/h), EDGAR ~45 min, Bloomberg/FactSet 24-48 h, $24-30k/seat/yr; Elastic agent "$0.15-$1.20, 30-120 sec" | `TraditionalComparison.tsx:32-37,52-77,93-99,215-221` | live row cost uses Sonnet $3/$15 (`:105-107`) |
| Conclusion | "100K × 1536-d Rally vectors: 24× end-to-end (16.6× ingest + 106× force-merge)"; "70-100 ms kNN over 93K chunks"; "26 → 3 LLM calls" | `Chapter05_Conclusion.tsx:21,27,29` | DOC-ONLY (bench) |
| AgentConfigCard chip | "GPU-built … 50× faster force-merge than CPU" | `AgentConfigCard.tsx:40` | |

---

## 4. Adventure 3: Multimodal + DLS (committed version)

### 4.1 Scenes (`demo/frontend/src/components/jina/JinaApp.tsx:13-16`)

| Scene | Content | API | Source |
|---|---|---|---|
| Search by Image (default) | "type words, get pictures" over a 10-doc synthetic shapes track; Image-vectors vs Caption-vectors toggle | `GET /api/jina/multimodal/search?q&space` → ES kNN with `query_vector_builder` (model `jina-omni-text`) on `image_vector`/`caption_vector`, k=6 | `MultimodalSearch.tsx:6-12,60-61`; `routers/jina.py:78-112` |
| Need-to-Know | 4 analyst cards, accessible-corpus banner "N / 509 docs" + classification facets, query → hits + figure strip + generative answer | `GET /api/jina/analysts`, `GET /api/jina/search`, `GET /api/jina/analyst/answer` | `NeedToKnow.tsx:18-75`; `api.ts:73-160` |

- Esc exits; "Exit to chooser" button (`JinaApp.tsx:21-25,64-70`).
- Sample queries, Search by Image: "a red square", "something blue and round", "green triangle", "horizontal stripes", "a yellow star" (`MultimodalSearch.tsx:6-12`).
- Sample queries, Need-to-Know (`NeedToKnow.tsx:12-17`):
  - "What methods are used for single-cell RNA sequencing?"
  - "Summarize findings on CRISPR off-target effects"
  - "Which imaging techniques detect early-stage tumors?"
  - "What is known about gut microbiome and immunity?"

### 4.2 Personas (`demo/backend/app/services/jina_dls.py:18-39`)

| id | Name | Clearance | Compartments | NOFORN-cleared (US) | Label |
|---|---|---|---|---|---|
| public | Public User | U | none | no | "U · no compartments · foreign" |
| secret_si | Analyst A | S | SI | yes | "SECRET · SI · US" |
| ts_hcs | Analyst B | TS | SCI, HCS, SI | yes | "TS/SCI · HCS · SI · US" |
| ts_all | Senior Analyst | TS | SCI, HCS, TK, SI | yes | "TS/SCI · HCS · TK · SI · US" |

Default persona is `public` (`jina_dls.py:41`). Unknown ids fall back to public (`:44-45`).

### 4.3 Marking and enforcement rules

- Hierarchy U < CUI < C < S < TS. Compartments SCI, HCS, SI, TK (`jina_dls.py:13-15`).
- Filter (`jina_dls.py:52-80`):
  1. `classification ∈ allowed_levels(clearance)`.
  2. No `compartments` field, OR `terms_set` with `minimum_should_match_field: compartments_count`. That means the analyst must hold **all** of the doc's compartments. The `["__none__"]` sentinel is used when the analyst holds none.
  3. `must_not caveats: NOFORN` unless the analyst is NOFORN-cleared.
- **Enforcement is an application-side query filter, not native ES DLS or role-based security.** No `_security/role` or run_as is defined anywhere (NOT FOUND). Anyone with ES credentials sees everything.
- The same filter is applied to facets, hybrid hits, the figure strip (plus `chunk_type: image`), and analyst answer retrieval (`routers/jina.py:121-135,165,215,271`).
- Marking assignment is deterministic by md5(parent_id) (`demo/scripts/jina/markings.py:19-66`):
  - Distribution U 40 / CUI 25 / C 15 / S 13 / TS 7 %.
  - Compartments only on S/TS (cap 2 for S, 3 for TS).
  - NOFORN on 45 % of C/S/TS; ORCON on 25 % of TS.
  - Releasability USA, or USA+FVEY at 40 % when not NOFORN.
  - source_type is one of OSINT/IMINT/HUMINT/SIGINT.
- HANDOFF says these are "our own deterministic model, not the source demo's exact assignments" (`HANDOFF.md:42-43`).

### 4.4 Indices and dims

| Index | Dims | Notes | Source |
|---|---|---|---|
| `jina-multimodal` | `image_vector` 768 + `caption_vector` 768, cosine | image vectors embedded app-side by the Jina server; captions by ES pipeline `jina-embed-caption` | `setup-indices-local.sh:48-60`, `ingest-multimodal.py:1-27` |
| `pmc-unstructured` | `embedding` 1024 cosine, **bbq_hnsw**; DLS fields classification/compartments/compartments_count/caveats/releasability/source_type | 1 shard, 0 replicas | `setup-indices-local.sh:62-92` |

- **Real kit corpus: 198 papers, 9,636 text chunks, 2,218 figure references.** `ingest-pmc.py` reads `hires_chunks.jsonl` and `hires_images.jsonl` (source `~/Desktop/Jina/demo-multimodal/scale/`, counted 13 Nov 2026). Licences: 149 CC BY, 1 CC0, 48 NC/ND variants. 509 is the older JATS ingestion path in the original search UI.
- **509 papers: STAGED/DOC-ONLY.** It appears as hardcoded UI text and the denominator `/ 509 docs` (`NeedToKnow.tsx:50,74`), plus `JINA-SETUP.md:8`, `AdventureChooser.tsx:146`, and `HANDOFF.md:36`.
- The numerator `accessible.docs` is **MEASURED** (cardinality of `parent_id` under DLS, `routers/jina.py:130,147`). `accessible.chunks` is also MEASURED (`:148`).
- `JINA-SETUP.md` also states 9,636 text chunks and 198 image records (DOC-ONLY, `JINA-SETUP.md` data-staging block).

### 4.5 Analyst answer flow (`routers/jina.py:254-325`)

1. `_omni_embed(q)` posts to `JINA_OMNI_URL/v1/embeddings` with no `dimensions`, so the server default is 1024 (`:48-55`, `serve_jina_v4.py:37,102`).
2. RRF of BM25 `match content` plus kNN `embedding` k=50/num_candidates 200, with `filter: dls`, collapsed on `parent_id`, size k=6 (`:268-284`).
3. If there are no sources, the canned answer is "No documents in your accessible corpus match this question…" (`:306-312`).
4. Passages are capped at 1,200 chars each and tagged `[parent_id]`. The `ANALYST_SYSTEM` prompt forbids outside knowledge (`:244-251,293-304`).
5. `invoke_llm` runs gpt-oss via Ollama, max_tokens 900, temp 0.1, 120 s timeout (`:319`, `services/llm.py:21`).

In the UI, the search call and answer call fire together on submit (`NeedToKnow.tsx:30-35`).

### 4.6 LOCAL WIP, not on remote

Read only. `/Users/bholden/Desktop/ddil` is at commit `9c18a02`, **behind** 46ca60f and 5114c3a, and has many unrelated deletions in `git status`.

- **Backend `routers/jina.py` (+91 lines):**
  - `JINA_ES_API_KEY` adds ApiKey auth that overrides basic auth.
  - `JINA_EMBED_BACKEND = omni|inference`, where `inference` calls an in-cluster `_inference/{JINA_INFERENCE_ID}`, default `.jina-embeddings-v5-omni-nano`.
  - `JINA_LLM_BACKEND = ollama|inference`, where `inference` calls `_inference/chat_completion/.anthropic-claude-4.6-sonnet-chat_completion/_stream` and concatenates SSE deltas.
  - `/state` gains `embed_backend` and `llm`.
  - Purpose per comments: run the Jina adventure against Elastic Cloud ("where the corpus lives").
  - Source: `git -C ~/Desktop/ddil diff demo/backend/app/routers/jina.py`, `demo/backend/app/config.py`.
  - The WIP `config.py` still has raw-IP defaults (`JINA_OMNI_URL http://192.168.1.20:8081`). It predates the .ddil change and will conflict on merge.
- **Frontend shell rewrite (`JinaApp.tsx`):**
  - The sidebar is replaced by a header, a shared "Signed in as" persona bar, and a shared `CorpusMeter`.
  - Scenes are now **"Vector Search"** ("retrieval by meaning") and **"AI Analyst"** ("grounded answers").
  - The **Search by Image scene is dropped from navigation** (MultimodalSearch.tsx is still present but unreferenced).
  - Light theme `.jina-lite` (Elastic Blue #0b64dd) is in `App.css`. Light-theme `CLS_TONE` palette is in `lib/api.ts`.
- **New untracked files:**
  - `scenes/VectorSearch.tsx` (120 lines). Examples: "CRISPR off-target effects", "single-cell RNA sequencing methods", "imaging techniques for early tumor detection", "gut microbiome and immunity".
  - `scenes/AiAnalyst.tsx` (113 lines). Examples: "What do these papers say about hypoxia in tumors?", "Summarize findings on CRISPR off-target effects", "What is known about gut microbiome and immunity?".
  - `ui.tsx` (238 lines): AnalystCard, CorpusMeter, chips.
- **CorpusMeter default denominator is `total = 208` papers** (`ui.tsx` CorpusMeter signature, local line ~70). That conflicts with 509 everywhere else.
- `package.json`: dependency reorder only (react-markdown, remark-gfm already present).

---

## 5. Things that fail on stage

### 5.1 Prerequisites (code-derived)

- es-gpu needs:
  - `.env` with `ELASTIC_PASSWORD`.
  - The `elastic-certificates.p12` cert at the hardcoded host path.
  - The cuVS conda libs at `/home/blakester205/miniforge3/envs/cuvs-build/lib`.
  - CUDA libs at `/usr/local/cuda/lib64`.
  - Source: `docker/docker-compose.yml:36,46-48`.
- Framework needs `vm.max_map_count=262144` (`demo/docker-compose.yml:8`).
- Ollama on the Spark must have `gpt-oss:120b` and `nomic-embed-text` pulled (`config.py:23-24`). No repo script pulls them. `09-AI-INFERENCE.md` pulls llama/qwen instead.
- Jina server must be running on :8081 (`serve_jina_v4.py`), started manually in the `jina-embed` conda env. No systemd unit exists (NOT FOUND).
- Backend and frontend images run `pip install` / `npm install` at **build time**. An airgapped box needs prebuilt images or caches (`demo/backend/Dockerfile`, `demo/frontend/Dockerfile`).
- Data that is not in git:
  - `demo/data/preprocessed` (mounted to `/data`).
  - Synthetic vineyard JSONL.
  - The SEC NDJSON.
  - Jina `/data/jina/{manifest.json,images,scale/...}`.
  - Sources: `.gitignore`, `HANDOFF.md:108-109`, `JINA-SETUP.md`.
- Jina media must sit under `demo/data/preprocessed/jina/...` to appear at `/data/jina/...` inside the container (`demo/docker-compose.yml:89`).

### 5.2 Known failure points

| # | Failure | Effect on stage | Source |
|---|---|---|---|
| F1 | ES security ON at es-gpu, but the backend container gets no ES_USER/PASSWORD (not in compose env; `.env` excluded from image) | every backend ES call 401s. Vineyard Dashboard/Map **silently show STAGED fallback numbers**; chat Phase 0/1 fall back to mock BLK-C; SEC and Jina return errors | `docker/docker-compose.yml:28`, `demo/docker-compose.yml:66-72`, `demo/backend/.dockerignore:4`, `elasticsearch.py:9-13`, `vineyard.py:140,255,268`, `Dashboard.tsx:177-206`, `phase0_sensors.py:81-84` |
| F2 | es-cpu (9.3.1, security off, no transport TLS) vs es-gpu (9.4.2, security on, TLS required) | as committed the cluster cannot form; Kibana (pointed at es-cpu, no creds) is affected | `demo/docker-compose.yml:14,23-24,45-48`, `docker/docker-compose.yml:28-35` |
| F3 | `EMBED_BACKEND` defaults to `bedrock`; kit `.env` not read in the container | SEC Ch03 search → 502 "Query embed failed (bedrock)" | `config.py:38`, `finance.py:106-109`. Resolved in the working tree (0.3 S8, S13) |
| F4 | Vineyard Search hybrid/semantic: 768-d nomic query vs 8-d `reading_vector` | ES error → silent mock "Block B3 — Soil Station #17" results (blocks not in the estate). BM25 `multi_match fields:["*"]` across numeric fields is also likely to error (unverified) | `services/search.py:15-52`, `routers/search.py:39-62` |
| F5 | Crop Health scanner | always returns the same "Black Rot" result regardless of image | `routers/images.py:8-27` |
| F6 | gpt-oss:120b cold load or slow generation > 120 s | Phase 1 (outside try) raises inside the SSE generator. The stream ends without `job_complete`, and the UI may stay "running" (`isRunning` is never reset on a clean EOF) | `services/llm.py:21`, `chat.py:77,93,187`, `useAgentStream.ts:85-123` |
| F7 | 4 sequential LLM calls | worst case about 8 min per vineyard question; 3 heartbeat messages per phase only | `chat.py:104-167`, `llm.py:21` |
| F8 | Typed vineyard questions have no block_id | answers grounded on whatever block has the latest timestamp, not the block named in the question | `AgentChat.tsx:345-351`, `phase0_sensors.py:33-37` |
| F9 | SEC agent chat has no read timeout | a hung gpt-oss/Agent Builder run hangs the UI indefinitely | `finance.py:235` |
| F10 | Agent Builder `converse/async` on Kibana 9.3.1 (script comment targets 9.4) | API/event-shape mismatch risk; verify on box | `demo/docker-compose.yml:45`, `provision-agent-local.sh:82-83` |
| F11 | `run-all.sh` only passes `EP`; `setup-index-local.sh` needs `ES_USER`/`ES_PASSWORD` for auth | with security on, step 2 index create/bulk 401s | `run-all.sh:14,25`, `setup-index-local.sh:19-22` |
| F12 | `setup-indices.sh`, `bulk-index-synthetic.sh`, and `race.sh` have no auth | vineyard data load fails against secured es-gpu | `setup-indices.sh:19,24`, `bulk-index-synthetic.sh:30,40`, `race.sh:18-19,40-45` |
| F13 | Workflows chapter links to `daily-10-k-ai-risk-digest` | 404 in Kibana; not provisioned | `Chapter04_5_Workflows.tsx:5,86,96` |
| F14 | Jina media path mismatch (config default vs `.env.airgapped` `/scale/` paths) | figure strip and PDF links 404 if `.env` is not applied | `config.py:75-77`, `.env.airgapped:37-39`, `jina.py:337-358` |
| F15 | Jina query embedded with `prompt_name="passage"` | weaker query/passage retrieval (quality, not an error) | `serve_jina_v4.py:39,81` |
| F16 | Race WebSocket reconnect loop (vineyard hook reconnects every 3 s after the server closes) | harmless re-sends of the final state; noisy | `hooks/useWebSocket.ts:37-41`, `race.py:26-29` |
| F17 | Kiosk health `MOCK = true` | kiosk shows mock health unless flipped | `demo/kiosk/src/lib/health.ts:37` |
| F18 | .ddil names unverified (commit says app not running) | if UniFi DNS or extra_hosts are wrong, every cross-host call fails | commit 5114c3a message |

### 5.3 Reset steps

- In-app: vineyard "Reset Demo" (`App.tsx:92-101`); SEC/Jina Esc or Exit (`SecDeck.tsx:45`, `JinaApp.tsx:22`). Race Reset button → `POST /api/race/reset` (`race.py:35-38`).
- Clear AgentChat history: Reset Demo removes `vineyard-conversations` (`App.tsx:100`).
- SEC agent: "Reset conversation" button in Ch04 (`Chapter04_AgenticAction.tsx:68`).
- Stack:
  - Spark: `sg docker -c "docker compose up -d|down|down -v"` (`docker/docker-compose.yml:4-6`).
  - Framework: `docker compose up -d|down|down -v` (`demo/docker-compose.yml:4-6`).
- Health banner: `scripts/ddil-startup.sh:105-127`. It checks raw IPs without auth and probes Ollama embed on .10, which is stale.
- TROUBLESHOOTING.md is largely stale (see C17). Use it only for generic ES fixes (memlock, max_map_count, allocation explain) (`TROUBLESHOOTING.md:68-120`).

---

## 6. Conflicts and stale claims

| # | Claim A | Claim B (code / truth) | Sources |
|---|---|---|---|
| C1 | Single cluster ES "9.3.1" (CLAUDE.md); UI says "9.4.2" everywhere incl. "ES (CPU) 9.4.2 stock" | es-gpu **9.4.2**, es-cpu **9.3.1**, Kibana **9.3.1**; es-gpu security ON + TLS, es-cpu security OFF | CLAUDE.md; `Architecture.tsx:137`; `docker/es-gpu/Dockerfile:1`; `demo/docker-compose.yml:14,23,45` |
| C2 | Chooser "869K sensor records" | 869,000 is the sum of all 5 indices; soil sensors are 841,536 | `AdventureChooser.tsx:62`; `Dashboard.tsx:186-193` |
| C3 | DEMO-PLAN / DATASET-STRATEGY "615K+ vectors", System screen "615K+ … GPU ~22s / CPU ~150s" | race uses 841,536; architecture says 869K | `DEMO-PLAN.md:9,30,182`; `SystemOverview.tsx:70-71`; `indexer.py:18` |
| C4 | indexer docstring "50K vector corpus" | `TOTAL_DOCS = 841536` | `indexer.py:3,18` |
| C5 | "12x faster" (RaceIntro, RaceDashboard explainer, Architecture) | staged race shows ≈3.7× end-to-end, ≈7.1× merge. Ch05 says 24× (16.6×/106×). AgentConfigCard says 50× merge. A May real run did not reproduce 12×/7× (per user's notes, outside repo) | `RaceIntro.tsx:108,128`; `RaceDashboard.tsx:241`; `Architecture.tsx:246`; `metrics.py:76-88`; `Chapter05_Conclusion.tsx:21`; `AgentConfigCard.tsx:40` |
| C6 | CPU rate "~2,400 v/s" (RaceIntro) | indexer target 4,200; CLAUDE.md 4,200; final computed ≈15,300 | `RaceIntro.tsx:119`; `indexer.py:90` |
| C7 | Race displays 28,500 / 4,200 v/s | final throughput = 841,536/elapsed ≈ 56,100 / 15,300 v/s (progress bar implies these) | `indexer.py:42-47,75` |
| C8 | Recall 98.9 % / 98.7 % "identical quality" | hardcoded, "Will be computed post-race" | `metrics.py:90-91` |
| C9 | Search screen "Hybrid RRF (BM25 + kNN)" | nomic 768-d query vs 8-d field → always mock fallback; latency embed 12 ms hardcoded | `services/search.py:16-48`; `routers/search.py:36,39-62` |
| C10 | AI Agronomist via "Elastic Agent Builder" (chooser, Architecture, CLAUDE.md agent `vineyard-advisor` + 5 tools) | pipeline is pure Python + Ollama; no Agent Builder call; agent/tools not provisioned anywhere | `AdventureChooser.tsx:70`; `chat.py`; NOT FOUND |
| C11 | Chat "phases 2-4 run in parallel" | sequential | `chat.py:42,91` vs `:104-167` |
| C12 | Imagery "2048-dim" (RaceIntro, CLAUDE.md, race.sh), "15K+ … CLIP vectors" (scanner) | mapping 768-d; 17,151 docs; scanner is canned | `RaceIntro.tsx:17`; `setup-indices.sh:82`; `es_mappings.py:71`; `LeafScanner.tsx:59`; `race.sh:20-21` |
| C13 | System screen: ES CPU on Spark :9201, Ollama nomic on Framework, LLM `llama3.1:70b` | ES CPU is on Framework :9200; Ollama (both models) on Spark; LLM gpt-oss:120b. RaceDashboard/SEC labels also say CPU "Port 9201"; `ES_CPU_PORT` default 9201 | `SystemOverview.tsx:94,104-105`; `RaceDashboard.tsx:193`; `config.py:15`; `demo/docker-compose.yml:30` |
| C14 | Jina model "jina-embeddings-v5-omni-small" (config, setup scripts, JINA-SETUP, `/api/jina/state`) | server actually loads `jinaai/jina-embeddings-v4` and echoes the caller's model name back | `config.py:65`; `serve_jina_v4.py:36,125`; `JINA-SETUP.md` prereq 1 |
| C15 | Inference endpoints `ollama-embeddings` (Jina v4 GGUF 2048-d) and `ollama-chat` | not created by any script; only `jina-omni-text` (768-d openai service) exists | CLAUDE.md; `setup-indices-local.sh:23-35` |
| C16 | SEC deck shows AWS g6 instances and L4 with kit IPs; "Built on the L4 GPU node in chapter 01"; "GPU-built `sec_10k_2026` index (chapter 01)"; "embedded with Bedrock Cohere Embed v4" | on the kit, Ch01 is the staged vineyard simulator; the SEC index is built by `setup-index-local.sh` (768-d nomic, CPU/GPU unspecified); no L4 | `Chapter00_Architecture.tsx:76-125`; `Chapter03_DataInterface.tsx:149`; `Chapter02_5_Elastic.tsx:82`; `AgentConfigCard.tsx:37-40`. Resolved in the working tree (0.3 S1, S4) |
| C17 | SEC LLM shown as "Bedrock · via Kibana connector", "Sonnet 4.6"; cost priced at Sonnet rates; "show the call" says 1536-d Cohere | kit uses gpt-oss:120b via Ollama connector + nomic 768-d | `AgentConfigCard.tsx:37-38,46`; `TraditionalComparison.tsx:114`; `Chapter05_Conclusion.tsx:29`; `TradeoffPanel.tsx:32-36`; `finance.py:154`. Resolved in the working tree (0.3 S5, S7) |
| C18 | TCO reduction: 78 % (WhyItMatters, pricing.ts comment) | 89.4 % (EconomicsPanel; "89%" in Ch02.5 and Workflows) vs ≈70 % (Ch01 headline from staged race) | `WhyItMatters.tsx:15`; `pricing.ts:10`; `EconomicsPanel.tsx:28`; `Chapter02_5_Elastic.tsx:17`; `Chapter04_5_Workflows.tsx:120`; `Chapter01_Speed.tsx:182` |
| C19 | Ch01 subtitle "live, real-time race … GPU-accelerated CAGRA indexing on identical data sets" | staged simulator, no indexing | `Chapter01_Speed.tsx:123`; `indexer.py` |
| C20 | EconomicsPanel comment: race gives "~1k v/s CPU, ~16k v/s GPU" on a 100K subset | kit simulator gives 4.2k/28.5k displayed, 15.3k/56.1k final | `EconomicsPanel.tsx:24-27` |
| C21 | Chooser says "509 papers"; NeedToKnow says "/ 509 docs" | LOCAL WIP CorpusMeter says "/ 208 papers" | `AdventureChooser.tsx:146`; `NeedToKnow.tsx:74`; local `ui.tsx` |
| C22 | Need-to-Know "document-level security" | app-side query filter; no ES roles/DLS | `jina_dls.py:52-80`; NOT FOUND `_security/role` |
| C23 | Estate center 46.015N 118.38W (backend/map, CLAUDE.md) | datagen center 46.0655, -118.3420 (soil `location` geo_points would sit about 6 km away) | `vineyard.py:12`; `datagen/config.py:18-19` |
| C24 | "22 acres" | block acres sum to 21.6 | `AdventureChooser.tsx:55`; `vineyard.py` acres |
| C25 | `.env.airgapped` workflow "copy to demo/backend/.env and restart" | `.env` is excluded from the image and compose has no env_file, so it only works for native `run.sh` | `.env.airgapped:2-3`; `.dockerignore:4`; `demo/docker-compose.yml:62-93` |
| C26 | Chooser CCS card "ECH coordinating cluster, DDIL box as a remote" (also HANDOFF) | CLAUDE.md and config say the **box** is the coordinator and dials out to ECH (out of scope, noted for consistency) | `AdventureChooser.tsx:182-186`; `HANDOFF.md:46-47`; `config.py:79-83` |
| C27 | CLAUDE.md config block shows raw IPs | config.py now uses .ddil names (5114c3a) | CLAUDE.md "Config"; `config.py:7,18,21-22,47,64` |
| C28 | Kiosk docs: endpoints pre-wired to `192.168.1.20:9200/9201/11434` | health.ts now uses .ddil names and framework.ddil:9200 for CPU | CLAUDE.md kiosk section; commit 5114c3a health.ts diff |
| C29 | TROUBLESHOOTING: containers `ddil-elasticsearch`/`ddil-kibana`, Streamlit :8501, `ddil-demo` service, `/opt/ddil/scripts/run-all-tests.sh`, `ollama pull llama3.1:70b`; "Unload unused models" uses `DELETE /api/delete`, which **deletes the model from disk** | real containers es-gpu/es-cpu/kibana/backend/frontend; React+FastAPI; gpt-oss. Do not run the /api/delete "unload" step | `TROUBLESHOOTING.md:7-12,76,174,196,206` |
| C30 | `09-AI-INFERENCE.md` / `SBOM.md` model set llama3.1 70b/8b, qwen2.5:72b, mxbai, mistral, phi3 | code uses only gpt-oss:120b + nomic-embed-text (+ Jina v4 outside Ollama) | `09-AI-INFERENCE.md:80-174`; `SBOM.md:95-97`; `config.py:23-24` |
| C31 | `ddil-startup.sh` checks Ollama embed on 192.168.1.10 and counts docs on .10:9200 without auth | Ollama is on .20; ES now requires auth | `scripts/ddil-startup.sh:105-119` |
| C32 | `provision-agent-local.sh` header calls itself "provision-agent-tools.sh" and says "PUT only updates in 9.4" | Kibana pinned 9.3.1 | `provision-agent-local.sh:2,82`; `demo/docker-compose.yml:45` |
| C33 | RaceIntro has an SEC branch with "TBD" counts; CLAUDE.md "SEC Findings (TBD)" in Demo Flow | SEC skips RaceIntro entirely; deck is wired | `RaceIntro.tsx:22-33`; `App.tsx:138-140` |
| C34 | HANDOFF: Jina server = "omni-small (Blackwell cu128)" from Ben's toolkit | repo now vendors `serve_jina_v4.py` as the "airgapped replacement" | `HANDOFF.md:40-41`; `serve_jina_v4.py:5` |
| C35 | Architecture lists "Ollama — Jina v4 4.6 GB Embeddings" and "Inference Endpoint ES → Ollama" | no such Ollama model or endpoint used | `Architecture.tsx:119-120` |
| C36 | `RACE_BATCH_SIZE=500`, race `index_name` param | unused by the staged race | `config.py:30`; `indexer.py:79` |
| C37 | SEC `HARDWARE.cpu` "g6.8xlarge … 32 vCPU AMD EPYC · no GPU" | AWS g6.8xlarge is an L4 GPU instance type (external knowledge; verify before quoting) | `pricing.ts:23,28`; `Chapter00_Architecture.tsx:89-91`. Resolved in the working tree (0.3 S1) |
