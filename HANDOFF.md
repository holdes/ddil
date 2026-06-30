# Handoff — Changes Since Last Sync

> Purpose: a change log so a session picking this up on another machine knows
> what we modified, without re-diffing. This is **not** a setup guide.

**Synced to:** `github.com/holdes/ddil` (origin) · `blakebholden/ddil` retained as `upstream`
**Delta:** 2 commits on top of the last remote state (`a11acd9`) — **113 files, +5,114 / −1,156**

## Commits
- `f85167a` — Complete demo rebuild: one-cluster architecture, coherent vineyard data, containerized app
- `b37a344` — Add kiosk deploy assets, map tiles, branding, and GPU cuVS JAR

## What changed, by area

### Architecture — single ES cluster across both nodes
- `docker/docker-compose.yml` (new) + `docker/es-gpu/Dockerfile` (new) — Spark GPU ES node
- `docker/es-gpu/cuvs-java-25.12.0.jar` (new, 1.3 MB) — aarch64 cuVS build for GPU HNSW
- `demo/docker-compose.yml` — reworked to the one-cluster (`ddil-vineyard`) topology; Framework runs ES CPU node + Kibana + backend + frontend
- `scripts/ddil-startup.sh` (new) — kit bring-up; `scripts/validate-dgx-cuvs.sh` tweaked

### Data generation — new causal model (`demo/datagen/`, all new)
- `weather.py → soil.py → npk.py → harvest.py` driven by `config.py`, run via `generate.py`
- Produces the coherent vineyard dataset (Domaine de la Côte Cachée). **Output data is gitignored — regenerate or copy separately.**

### Ingest / indexing scripts (`demo/scripts/`)
- New: `bulk-index.sh`, `bulk-index-synthetic.sh`, `preprocess-harvest.py`, `race.sh`
- Reworked: `setup-indices.sh`, `preprocess-soil.py`, `embed-images.py`

### Frontend (`demo/frontend/`) — multi-adventure rebuild + containerized
- New components: `AdventureChooser`, `Architecture`, `Dashboard`, `RaceIntro`
- Major rewrites: `App.tsx`, `VineyardMap`, `AgentChat`, `RaceDashboard`
- Containerized: new `Dockerfile`, `.dockerignore`, `vite.config.ts` + `package.json` updates

### Backend (`demo/backend/`)
- New: `vineyard.py` router, `Dockerfile`, `.dockerignore`
- Updated: `main.py`, `config.py`, routers `chat.py`/`race.py`, services `indexer.py`/`metrics.py`, phase `prompts.py`

### Kiosk (`demo/kiosk/deploy/`)
- `kiosk-launch.sh` — auto-detect the panel's native mode (real EDID), fall back to the CVT modeline; cycle output to force re-handshake on the DeskPi RTK panel
- `install.sh` — `systemctl enable ddil-kiosk.service` so the kiosk autostarts

### Assets
- `branding/` (new) — Elastic logos + `deploy-splash.sh`
- `demo/data/tiles/` (new, 62 PNGs / ~316 KB) — pre-downloaded CartoDB Dark Matter tiles so the Leaflet map works offline
- `CLAUDE.md` — updated to match the rebuilt architecture

## Not in git (copy or regenerate separately)
- `demo/data/{raw,preprocessed,synthetic}` (~2.8 GB) — bulk + synthetic datasets; gitignored. Regenerate via `demo/datagen/` + `demo/scripts/`, or transfer by USB/scp.
