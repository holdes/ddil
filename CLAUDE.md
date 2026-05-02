# DDIL Demo Kit · Sovereign AI

## Project Context

This is a portable, airgapped AI search and RAG system in a Pelican case ("DDIL Kit"). Two compute nodes, no cloud dependency. The kit is a **multi-demo appliance** — the public/messaging brand on the kiosk display is "Sovereign AI · Context Engineering Anywhere"; individual demos (e.g. the Vineyard Intelligence agronomist below) plug in as runtimes.

### Hardware
- **Framework Desktop** (192.168.1.10): Ryzen AI Max+ 395, 64GB, x86_64 — runs frontend, backend, embeddings, **and the kiosk display**
- **DGX Spark** (192.168.1.20): GB10 Blackwell, 128GB unified memory, aarch64 — runs Elasticsearch, LLM inference, GPU vector indexing
- **Touchscreen** (HDMI from Framework): DeskPi 7.84″ 1280×400 TFT in a 2U rack mount. **Reports a fake "RTK FHD" 1920×1080 EDID** — Linux/`xrandr` can force the real 1280×400 modeline; macOS cannot easily, so dev/QA on Mac uses Chrome DevTools at 1280×400.
- **Network**: UniFi Express 7 (gateway .1), Switch Flex Mini, JetKVM for remote console

### Demo Goals

**Act 1 — Indexing Race:** GPU vs CPU vector indexing on the **same DGX Spark**. Two ES 9.x instances:
- Port 9200: `vectors.indexing.use_gpu: true` (cuVS GPU-accelerated HNSW)
- Port 9201: `vectors.indexing.use_gpu: false` (standard CPU HNSW)
- Race corpus: 615K+ pre-embedded vectors (500K soil + 100K environmental + 15K disease images)
- `vectors.indexing.use_gpu` is a **node-level** setting, NOT per-index — hence two ES instances

**Act 2 — Context Engineering Anywhere:** Agentic multi-phase advisor, search, RAG, live sensors, image similarity — the full Elastic AI story running disconnected.

### Architecture: Agentic Chat Pipeline

The AI Agronomist uses a **5-phase agentic pipeline** modeled on CanadaBuys bid analysis. Each phase streams progress via SSE (Server-Sent Events).

**Phases:**
1. **Phase 0 — Sensor Snapshot:** ES-only query for current sensor readings (no LLM)
2. **Phase 1 — Historical Context:** kNN vector search for similar past conditions + LLM pattern analysis
3. **Phase 2 — Risk Analysis:** LLM assessment of disease, moisture, nutrient, temperature risks
4. **Phase 3 — Crop Recommendation:** LLM generates prioritized management actions
5. **Phase 4 — Action Plan:** LLM creates concrete task list with assignments and deadlines

**SSE Format:** `event: <type>\ndata: <json>\n\n`
- Events: `job_start`, `phase_start`, `phase_progress`, `phase_complete`, `phase_error`, `job_complete`, `job_error`
- Endpoint: `POST /api/chat/agent/stream`

**Key backend files:**
- `demo/backend/app/services/phases/pipeline.py` — SSE orchestrator
- `demo/backend/app/services/phases/phase0_sensors.py` through `phase4_action_plan.py` — individual phase runners
- `demo/backend/app/services/phases/prompts.py` — LLM prompt templates
- `demo/backend/app/models/agent_models.py` — Pydantic models for all phases
- `demo/backend/app/services/llm.py` — Ollama LLM wrapper (`invoke_llm`, `invoke_llm_json`)

**Key frontend files:**
- `demo/frontend/src/components/AgentChat/AgentChat.tsx` — Phase card UI with live progress
- `demo/frontend/src/components/AgentChat/useAgentStream.ts` — SSE consumer hook

### cuVS on aarch64 (CRITICAL)

The ES GPU plugin (cuVS) is x86_64-only due to 3 soft gates in cuvs-java. See `CUVS-AARCH64-BUILD.md` for the full build guide. Key gates:
1. `CuVSServiceProvider.java:65` — `os.arch.equals("amd64")` check
2. `LoaderUtils.java:52` — hardcoded `linux_x64` path (bypass via `CUVS_JAVA_SO_PATH` env var)
3. `pom.xml:180` — packaging path

**First task on DGX Spark:** Run `scripts/validate-dgx-cuvs.sh` to check CUDA, compute capability, build tools.

### Tech Stack
- Frontend: React + Vite + TypeScript + Tailwind (on Framework)
- Backend: FastAPI + elasticsearch-py + httpx (on Framework)
- Search: Elasticsearch 9.x with dense_vector fields, hybrid RRF retrieval
- Embeddings: Ollama nomic-embed-text (on Framework, port 11434)
- LLM: Ollama llama3.1:70b (on DGX Spark, port 11434)
- Sensors: RS485 Modbus soil probes, NPK sensors (live data)
- **Kiosk** (separate React/Vite/TS/Tailwind app at `demo/kiosk/`, runs in Chromium on the touchscreen, port 3100)

### Touchscreen Kiosk (Sovereign AI Shell)

The 1280×400 panel runs an **independent React app** at `demo/kiosk/` — a meta-shell for the kit, **separate from the main demo frontend**. It's the "always-on" display: branding, system health, machine telemetry, easter egg. Demos themselves run on the main tablet/PC, not here.

**Modes:**
1. **Boot Diagnostics** — animated startup probe of ES-GPU/CPU, Ollama LLM/embed, backend, sensor bus. Auto-advances to Idle.
2. **Idle** — 2-page swipe carousel.
   - *Page 1 — Branding:* Elastic ↔ DGX Spark identity flanking a centered QR (locally-generated SVG via `qrcode.react`, points to `elastic.co/geospatial`), "Sovereign AI / Context Engineering Anywhere" headline, capability ticker.
   - *Page 2 — Diagnostics:* live (mock) Framework + DGX Spark hardware cards (CPU/GPU/RAM/VRAM bars, temp, uptime, IP pills) + bottom strip (Network · WAN · Display · Console).
3. **Easter Egg — INDEXER** *(hidden)* — Elastic-themed snake game. **Triggered by tapping the Elastic horizontal logo on the Branding page 5× in 3s.** ESC to exit. Dev hotkey: `3`.

**Controls:**
- Public-facing: **MODE ▸** button (cycles Boot ↔ Idle), swipe / arrow keys / page-dot buttons within Idle.
- Dev hotkeys: `1`/`2`/`3` jump to mode; **`** toggles a debug HUD (`?debug=1` also works) showing viewport, scale, DPR, letterbox.

**Stack independence:** The kiosk has its own `package.json` and is fully self-contained. `src/lib/health.ts` has a `MOCK = true` flag — flip to `false` once the demo backend on Framework is up; endpoints are pre-wired to `192.168.1.20:9200/9201/11434` and `/api/...`.

**Layout constraint:** Designed to a fixed 1280×400 stage scaled via `useFitScale`. Don't introduce viewport-relative sizes — keep everything in pixels relative to the 3.2:1 stage. Status bar is 28px tall (`top-7` not `pt-7` — absolute children ignore padding).

**Dev (any machine):** `cd demo/kiosk && npm install && npm run dev` → http://localhost:3100. Use Chrome DevTools at 1280×400 for pixel-accurate QA.

**Deploy (Framework, headless Ubuntu):** `cd demo/kiosk && npm run build && sudo ./deploy/install.sh`. The installer creates a `ddil` user, writes two systemd units (`ddil-kiosk-server` serves `dist/` on :3100; `ddil-kiosk` runs startx + Chromium kiosk on tty7), and `kiosk-launch.sh` registers a 1280×400 xrandr modeline before launching. Full guide: `demo/kiosk/deploy/DEPLOY.md`.

### Key Files
- `DEMO-PLAN.md` — Full implementation plan with wireframes
- `SPARK-SETUP.md` — **Complete DGX Spark setup instructions (START HERE on Spark)**
- `DATASET-STRATEGY.md` — 8 datasets, index schemas, data flow
- `CUVS-AARCH64-BUILD.md` — Step-by-step cuVS build for aarch64
- `scripts/validate-dgx-cuvs.sh` — Run this first on DGX Spark
- `demo/backend/` — FastAPI app (config points to DGX ports)
- `demo/frontend/` — React app with 7 scene components + AgentChat (the Vineyard demo)
- `demo/kiosk/` — **Touchscreen kiosk app (Sovereign AI shell)** — see "Touchscreen Kiosk" section above; dev guide in `demo/kiosk/README.md`, deploy guide in `demo/kiosk/deploy/DEPLOY.md`
- `demo/scripts/` — Dataset download, preprocess, index setup

### DGX Spark Tasks (Priority Order)

> **Read `SPARK-SETUP.md` first** — it has copy-pasteable commands for everything below.

1. **Docker Compose up** — `demo/docker-compose.yml` defines all 3 services:
   - `es-gpu` on port 9200 with `vectors.indexing.use_gpu: true` + GPU passthrough
   - `es-cpu` on port 9201 with `vectors.indexing.use_gpu: false` (no GPU)
   - `ollama` on port 11434 with GPU passthrough
   - Run: `sudo sysctl -w vm.max_map_count=262144 && docker compose up -d`
2. **Pull Ollama models** — `docker exec ollama ollama pull llama3.1:70b && docker exec ollama ollama pull nomic-embed-text`
3. **Apply Enterprise license** — `demo/license.json` included in repo, apply to both instances with `PUT /_license?acknowledge=true`
4. **Run `scripts/validate-dgx-cuvs.sh`** — assess cuVS build feasibility
5. **Create indices** — run `demo/scripts/setup-indices.sh` against both ES instances
6. **Download & preprocess data** — run scripts in `demo/scripts/` (requires internet, do before airgap)
7. **Bulk ingest data** — load JSONL files into both ES instances
8. **Attempt cuVS aarch64 build** (stretch goal, see `CUVS-AARCH64-BUILD.md`)

### Framework Desktop Tasks
1. Frontend dev server: `cd demo/frontend && npm run dev` (port 3000)
2. Backend: `cd demo/backend && python3 -m uvicorn app.main:app --port 8001`
3. Vite proxy forwards `/api/*` to backend at `:8001`, which reaches ES/Ollama on Spark
4. **Kiosk on the touchscreen:** `cd demo/kiosk && npm run build && sudo ./deploy/install.sh` — installs systemd units that auto-launch Chromium kiosk on tty7 with the correct 1280×400 modeline. After install, `journalctl -u ddil-kiosk -f` for live logs.

### Config (demo/backend/app/config.py)
```
DGX_SPARK_HOST = 192.168.1.20
ES_GPU_PORT = 9200
ES_CPU_PORT = 9201
OLLAMA_EMBED_URL = http://192.168.1.10:11434  (Framework, local embeddings)
OLLAMA_LLM_URL = http://192.168.1.20:11434    (Spark, GPU inference)
LLM_MODEL = llama3.1:70b
EMBED_MODEL = nomic-embed-text
```
