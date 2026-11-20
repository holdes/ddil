# DDIL dev stub

A stand-in for the kit backend (`demo/backend/app`) that runs on a laptop with no kit. It serves the in-scope screens of the live demo frontend (`demo/frontend`) with the same request and response shapes, the same streaming formats and kit-like timing. It needs no Elasticsearch, Ollama, Jina server or internet.

- Node 22 or later, standard library only. No `npm install`, no Python packages.
- Binds `127.0.0.1` only. Makes no outbound network calls. Map tiles come from `demo/data/tiles` or a generated placeholder.
- Nothing under `demo/` is modified. The stub reads `demo/data/tiles` and the trainer mock under `enablement/mock`.

In scope: Vineyard Intelligence, SEC Findings, Multimodal (Search by Image and Need-to-Know). Out of scope: Edge Federation (CCS) and satellite; `/api/ccs/*` returns 404.

## Start and stop

```bash
enablement/devstub/run.sh          # foreground, Ctrl-C stops it
enablement/devstub/run.sh --bg     # background: log in stub.log, pid in .stub.pid
enablement/devstub/run.sh --stop   # stop the background stub
```

`run.sh` uses port 8000. If 8000 is taken by another process, it picks the first free port in 8010 to 8019 and prints the matching frontend command, for example:

```bash
cd demo/frontend
API_URL=http://127.0.0.1:8010 WS_URL=ws://127.0.0.1:8010 ./node_modules/.bin/vite --port 5180 --strictPort --host 127.0.0.1
```

Open http://127.0.0.1:5180. The Vite proxy forwards `/api` (including the race WebSocket) and `/tiles` to `API_URL`.

Environment:

| Variable | Default | Effect |
|---|---|---|
| `DEVSTUB_PORT` | 8000 | Listen port. When set explicitly and busy, `run.sh` exits instead of falling back. |
| `DEVSTUB_PACE` | 1 | Multiplier on agent, LLM and embed delays. 1 is kit pace; 0.3 is a quick run-through. The race always runs in real time. |

`POST /devstub/pace {"pace": 0.3}` changes the pace while the stub runs.

## Endpoints

25 kit endpoints, plus a stub control route, the CCS 404 and CORS preflight. Shapes come from the router named in the last column.

| Method | Path | Screen | Format | Kit router |
|---|---|---|---|---|
| GET | `/api/health` | none | JSON | `main.py` |
| POST | `/api/race/start` | Vineyard race, SEC 01 | JSON | `routers/race.py` |
| WS | `/api/race/status` | Vineyard race, SEC 01, SEC 02 chart | WebSocket, JSON text frame every 500 ms; closes 1 s after `complete` | `routers/race.py`, `services/indexer.py`, `services/metrics.py` |
| POST | `/api/race/reset` | race Reset | JSON | `routers/race.py` |
| GET | `/api/vineyard/config` | Dashboard mini map, Vineyard map | JSON | `routers/vineyard.py` |
| GET | `/api/vineyard/dashboard` | Dashboard | JSON | `routers/vineyard.py` |
| GET | `/api/vineyard/blocks/{id}/summary` | Vineyard map, 6 calls | JSON | `routers/vineyard.py` |
| POST | `/api/chat/agent/stream` | AI Agronomist | SSE: `job_start`, `phase_start`, `phase_progress`, `phase_complete`, `job_complete` | `routers/chat.py` |
| POST | `/api/chat` | none (RAGChat is not mounted) | JSON | `routers/chat.py` |
| POST | `/api/search` | Search | JSON | `routers/search.py` |
| POST | `/api/images/search` | Crop Health (multipart upload) | JSON | `routers/images.py` |
| GET | `/api/sensors/latest` | none | JSON | `routers/sensors.py` |
| GET | `/tiles/{z}/{x}/{y}.png` | Dashboard, Vineyard map | PNG | `main.py` |
| GET | `/api/finance/sectors` | SEC 03 | JSON | `routers/finance.py` |
| POST | `/api/finance/search` | SEC 03 | JSON | `routers/finance.py` |
| GET | `/api/finance/agent/state` | SEC deck config, SEC 04 card | JSON | `routers/finance.py` |
| POST | `/api/finance/agent/chat` | SEC 04 | SSE, Agent Builder grammar: `conversation_id_set`, `reasoning`, `tool_call`, `tool_progress`, `tool_result`, `thinking_complete`, `message_chunk`, `message_complete`, `round_complete`, `conversation_created`; each `data:` is `{"data": {...}}` | `routers/finance.py` (proxy), `hooks/useAgentChat.ts` (parser) |
| GET | `/api/jina/analysts` | Need-to-Know | JSON | `routers/jina.py` |
| GET | `/api/jina/state` | none | JSON | `routers/jina.py` |
| GET | `/api/jina/multimodal/search` | Search by Image | JSON | `routers/jina.py` |
| GET | `/api/jina/search` | Need-to-Know (browse and query) | JSON | `routers/jina.py` |
| GET | `/api/jina/analyst/answer` | Need-to-Know answer | JSON | `routers/jina.py` |
| GET | `/api/jina/figimg/{parent_id}/{file}` | Need-to-Know figure strip | JPEG | `routers/jina.py` |
| GET | `/api/jina/pdf/{parent_id}` | Need-to-Know PDF links | PDF | `routers/jina.py` |
| GET | `/api/jina/image/{file}` | Search by Image tiles | SVG | `routers/jina.py` |
| POST | `/devstub/pace` | none | JSON | stub control |
| any | `/api/ccs/*` | Edge Federation | 404 | out of scope |
| OPTIONS | any | CORS preflight | 204 | `main.py` CORS |

Validation errors return 422 in the FastAPI shape; unknown paths return 404 `{"detail": "Not Found"}`.

## Seed data per demo

### Vineyard Intelligence

- Estate, blocks and polygons: `VINEYARD_CONFIG` extracted verbatim from `routers/vineyard.py` into `data/vineyard-config.json`.
- Dashboard KPIs, index counts (869,000 total), block moisture, temperature, EC, NPK and 2024 harvest: the kit's own staged fallbacks (`Dashboard.tsx`, `VineyardMap.tsx` `MOCK_SUMMARIES`), as carried by `enablement/mock/js/data-vineyard.js`. Health and alert types follow the router's rules.
- AI Agronomist: the five-phase SSE stream of `routers/chat.py` with its progress and heartbeat messages (every 3 s). Phase content comes from the mock's per-story answers (Block C drainage, 2020 vs 2022 vintage, disease risk, Block E consistency, best block, drought, Le Plateau, weekly priorities), chosen by the mock's `pickResponse`. At pace 1 a run takes about 80 s, the mock's kit-pace budget.
- Phase 0 block: the `block_id` from the request. With none, the stub reads the block from the question ("Block C", "La Rivière") and falls back to BLK-F. The kit has no such inference: it takes the latest document across all blocks (FACTS F8).
- Search: keyword scoring over estate documents (soil, NPK and harvest per block, plus the historical matches). The kit returns two canned "Block B3 / B7" results for Hybrid and Semantic (FACTS C9); the stub returns estate data instead.
- Crop Health: the fixed Black Rot result that `routers/images.py` returns on the kit too.
- Race: a direct port of `services/indexer.py` and `metrics.py`: 841,536 docs, 500 ms ticks, GPU 28,500 v/s target, 48 ms merge, 15 s; CPU 4,200 v/s target, 340 ms merge, 55 s; recall 98.9 / 98.7.
- Model name in stream text: Nemotron 3.5 Lightning.

### SEC Findings

- Sector facet (11 sectors, 503 filings), hit lists for the five example searches, hit scores, agent tool runs and tool names (`finance.compare_companies`, `finance.company_disclosures`, `finance.sector_breakdown`, `platform.core.search`): `enablement/mock/js/data-sec.js`. Company names are public S&P 500 issuers.
- Passages are stand-in text written for the stub, marked "Stand-in passage from the dev stub, not filing text." Accession ids are `acc-stub-<TICKER>`, the same in search hits, tool results and answer citations.
- Any query maps to the nearest of five topics by keyword; sector chips filter the hits. The "show the call" body is the kit's kNN request with the vector shown as a 768-d placeholder.
- ES|QL tool results carry the exact queries of `demo/scripts/finance/provision-agent-local.sh`. Result rows carry a short section and topic label instead of passage text, so the table stays readable.
- Agent answers are the mock's answers with stub accession ids and a closing line that labels them as stand-in. At pace 1 a run takes 40 to 70 s.
- Config values: embed model `jina-embeddings-v5-omni-small`, embed backend `jina`, LLM `nemotron-3.5-lightning`, ES `http://es.ddil:9200`, Kibana `http://kibana.ddil:5601`. No AWS, Bedrock or cost values appear in any response.

### Multimodal

- Search by Image: the mock's ten synthetic shapes (`data-jina.js`), drawn as SVG. The kit's ten PNGs differ. Scores are keyword matches on colour and shape words with synonyms ("round" matches circle, disc, dot).
- Need-to-Know corpus: `enablement/mock/js/data-corpus.js`, 100 real CC BY and CC0 PubMed Central open-access papers (4,894 text chunks, 442 figures). Figures and PDFs are served from `enablement/mock/data/figs` and `enablement/mock/data/pdfs` (gitignored; run `enablement/mock/tools/pack_corpus.py` if missing). Attribution: `enablement/mock/data/corpus-manifest.json`.
- Markings: at startup the stub recomputes every paper's marking with the md5 logic of `demo/scripts/jina/markings.py` and logs any drift from the packed corpus (expected 0).
- Clearance filter: the rules of `demo/backend/app/services/jina_dls.py` (level hierarchy, every-compartment subset rule, NOFORN exclusion for non-US). Accessible papers: Public 43, Analyst A 83, Analyst B 98, Senior Analyst 100 of the 100-paper subset. Facets count text chunks plus figure documents, as the kit's aggregations count index documents.
- Retrieval is a keyword BM25 stand-in for the kit's BM25 plus Jina kNN fused with RRF. It reuses `enablement/mock/js/corpus-search.js`: DLS pre-filter before scoring, collapse to the best chunk per paper, top 8, figure strip from the top papers. Semantic matches with no shared words do not appear. Scores are shown in RRF scale.
- Reference-list chunks (858 of 4,894, detected by citation density or a References section) are blanked before indexing so keyword retrieval lands on body text.
- Analyst answer: extractive. It quotes the best-matching sentence from the top visible papers with `[PMCxxxxxxx]` citations and a closing line that labels it as stand-in. With no visible sources it returns the kit's no-answer text. On the kit Nemotron 3.5 Lightning writes the answer from the same filtered passages. The answer arrives after 6 to 10 s at pace 1.
- Known kit UI text: the meter prints a fixed "/ 509 docs"; the stub corpus has 100 papers. The kit's example chips (single-cell RNA sequencing, CRISPR, tumour imaging) have little keyword overlap with the subset; "gut microbiome and immunity" works well.

## Verify

`tools/walk.mjs` drives headless Chrome through the Chrome DevTools Protocol (no packages), walks every in-scope screen, writes screenshots to `shots/` and prints console errors and HTTP responses of 400 or above.

```bash
node enablement/devstub/tools/walk.mjs                  # all three demos, about 5 minutes
node enablement/devstub/tools/walk.mjs --only jina      # vineyard | sec | jina
```

Options: `--url` (frontend, default http://127.0.0.1:5180), `--stub` (default http://127.0.0.1:8010), `--pace` (default 0.35 during the walk; reset to 1 afterwards).

## Files

| Path | Purpose |
|---|---|
| `run.sh` | start, background, stop |
| `server.mjs` | HTTP routing, SSE, WebSocket (RFC 6455 server frames), static media, tiles |
| `lib/seed.mjs` | evaluates the mock's `data-*.js` and `corpus-search.js` in a sandbox |
| `lib/vineyard.mjs` | vineyard config, dashboard, block summaries, agent stream, search, crop health, sensors |
| `lib/race.mjs` | staged race, ported from `indexer.py` and `metrics.py` |
| `lib/sec.mjs` | sectors, search, agent state, Agent Builder stream |
| `lib/jina.mjs` | markings, personas, DLS search, analyst answer, image search |
| `data/vineyard-config.json` | `VINEYARD_CONFIG` from `routers/vineyard.py` |
| `tools/walk.mjs` | headless screen walk and screenshots |
| `shots/` | screenshots from the last walk |
