# GTC DC — Demo Overview

A single map of what we're showing at **GTC DC**, where each piece lives, how to
launch it, and its current status. This is the umbrella; each demo links out to
its own deeper doc.

> **Provenance note.** Items marked **✅ verified in-repo** were checked against
> the committed code/docs while writing this. Items marked **🛰 runtime** describe
> live cluster/hardware state captured from working notes — they are not fully
> reconstructable from git alone (dashboards, cluster config, deployed ML jobs),
> so re-verify against the live kit before relying on them in front of an audience.
> Last consolidated: **2026-11-20**.

## The two repos

| Repo | Remote | Branch | Role |
|---|---|---|---|
| `~/ddil` | `github.com/holdes/ddil` | `master` | The kit itself — AI search/RAG "Choose Your Adventure" app, cuVS GPU race, kiosk shell, satellite build + flight. **Public.** |
| `~/space-cyber-security-kit` | `github.com/holdes/space-cyber-security-kit` | `main` | SPARTA detection-analytics schema + *Operation Blind Horizon* security demo + Mission Operations Console + EDOT/OTel lane. **Public.** |

> **Secrets gotcha (both repos):** credentials live in a **gitignored `.env`**.
> A fresh clone has only `.env.example` — recreate `.env` before anything that
> talks to the cluster. (Dev work was pushed to the public repos 2026-11-13.)

## Hardware / hosts

| Host | Addr | What runs there |
|---|---|---|
| **DGX Spark** (GB10 Blackwell, 128GB, aarch64) | `192.168.1.20` | ES GPU node (cuVS), Ollama + vLLM inference, Jina omni server (:8081), OpenC3 COSMOS (:2900), cubesat console (:8088), EDOT collector target |
| **Framework Desktop** (Ryzen AI Max+ 395, x86) | `192.168.1.10` | ES CPU node + Kibana, demo backend/frontend, the kiosk display (:3100). **Also the `secdemo` 9.5.5 cluster at `:9210`/`:5611`.** |
| **Pi 5 `groundation`** | `192.168.1.238` | Real Zeek tap + Filebeat (the ground-station network capture feeding SPARTA) |
| **UniFi Express 7 "DDIL"** | `192.168.1.1` | Local gateway (standalone, no cloud) |

---

## Demo catalog

### 1. GPU Race — cuVS vector indexing  ✅ verified in-repo
**Where:** `~/ddil` adventure app (`:3000`), `RaceIntro`/`RaceDashboard`. **Story:**
GPU (cuVS/Blackwell) finishes 841K vectors in ~15s @ ~28,500 v/s; CPU grinds to
~55s @ ~4,200 v/s. Currently a **staged** race (`demo/backend/app/services/indexer.py`);
real cuVS build is `CUVS-AARCH64-BUILD.md`. The kiosk's **RALLY** easter egg
(`demo/kiosk/ARCADE.md`) riffs on the same GPU-vs-CPU beat.

### 2. Multimodal + Need-to-Know (Jina / DLS)  ✅ verified in-repo
**Where:** `~/ddil` adventure app, `adventure === "jina"` (`components/jina/`).
Two scenes: **Search by Image** ("type words, get pictures" via one native ES kNN
with `query_vector_builder`) and **Need-to-Know** — 198 research papers under a
document-level-security model, hybrid RRF + a clearance-scoped generative Research
Paper Analyst. Backed by the local **Jina omni server** (:8081, Blackwell cu128
build). Setup: `demo/scripts/jina/JINA-SETUP.md`. See CLAUDE.md § "Multimodal + DLS".

### 3. Choose-Your-Adventure AI search (Vineyard / SEC / Edge Federation)  ✅ verified in-repo
**Where:** `~/ddil` adventure app. **Vineyard Intelligence** (agentic agronomist over
a causal soil→NPK→harvest→wine model, Agent Builder + 5 ES|QL tools), **SEC Findings**
(8-chapter deck over S&P 500 10-Ks), **Edge Federation / CCS** (box dials out to
Elastic Cloud, "Synchronise Now" expands results edge→edge+cloud). Full detail in
`CLAUDE.md`.

### 4. SPARTA space-cyber pipeline + *Operation Blind Horizon*  🛰 runtime + ✅ repo
**Where:** `~/space-cyber-security-kit` (schema, rules, generators, Mission Ops
Console) → live `default` Kibana space on the main cluster. **Canonical pipeline is
live:** cubesat sim → real Zeek tap on `groundation` → Filebeat → Logstash (decodes
`parameters.*` + `spacecraft.id`) → ES `logs.ecs` / `logs-pisat-telemetry` → SPARTA
rules + ML jobs fire. Repo `STATUS.md` documents **69 validated / 35 parked** analytics
(July snapshot, 9.4.2); the live kit has grown well past that. **Launch:**
`python main.py --use-case security --fresh` or the console (`--ui`, `:8754`). See
`space-cyber-security-kit/DEMO-RUNBOOK.md`.

### 5. Servo / LED actuation + agent NL commanding  🛰 runtime
**Where:** real PCA9685 servos + SK9822 LEDs on the physical cubesat, commanded via
COSMOS/CCSDS (`SET_SERVO`/`SET_LED`, MID `0x19EA`). **Agent commanding:** chat
"LEDs green" → qwen3 → Elastic Workflow tool → `.webhook` → COSMOS → real hardware
(9 `payload_*` preset tools). `MECH_HK_TLM 0x09EA` telemetry flows back to Elastic;
4 real-data dashboards (`demosat-mission-ops` / `live-telemetry` / `mech-commands`).
Dashboards were API-authored, **not visually render-verified** — eyeball them first.

### 6. Satellite Mission Ops — Observability space  🛰 runtime
**Where:** `satellite-mission-ops` space on the **secdemo 9.5.5** cluster (`:5611`).
Native Lens dashboard `sat-mission-ops` (built via the elastic CLI + kibana-dashboards
skill). PELAGIA constellation: real DEMOSAT-2 + 5 sim in `satellite-mission-telemetry`.
**Open TODO:** the map panel (needs the Maps app).

### 7. Traces / Observability Relay — EDOT/OTel lane  ✅ verified in-repo
**Where:** `~/space-cyber-security-kit/docker-compose.collector.yml` +
`edot-collector.yaml`. An OpenTelemetry Collector (contrib) receives OTLP on
`:4318`/`:4317` from `payload_generators` and writes **OTel-native** mapping mode to
`metrics-<dataset>.otel-default` streams on ES (`192.168.1.20:9200`). `restart:
unless-stopped` so it survives reboot. **Launch:**
`docker compose -f docker-compose.collector.yml up -d` (needs `ES_API_KEY` in `.env`).

### 8. Nemo / Nemotron Lightning — local reasoning brain  🛰 runtime
**Where:** the **secdemo** roadshow cluster (Framework `:9210`/`:5611`, ES/Kibana
9.5.5). Two local brains wired as connectors: Ollama `qwen3-instruct` and
**Nemotron 3.5 Lightning 30B-A3B via vLLM (~94–112 tps, the winner)**. Snapshot
`snap-roadshow-ready`. **⚠ Open bugs:** (1) Lightning Agent-Builder hang = xgrammar
FSM (guidance-backend fix staged, not applied); (2) Attack Discovery `JSON.parse`
fails on both local brains — force structured output. Fix before demoing those paths.

---

## Pre-flight checklist (before a GTC run)

1. **Repos synced** — `git -C ~/ddil status` and `git -C ~/space-cyber-security-kit
   status` both clean + pushed.
2. **`.env` present** in both repos (not just `.env.example`).
3. **Clusters up** — main `ddil-vineyard` (both nodes), `secdemo` 9.5.5 on Framework.
4. **Inference up** — Ollama + vLLM on the Spark, Jina omni (:8081), COSMOS (:2900).
5. **Ground station** — `groundation` Pi reachable (.238), Zeek + Filebeat containers running.
6. **Kiosk** — touchscreen showing the Sovereign-AI shell (:3100); arcade reachable.
7. **Secdemo open bugs** (items 8 above) worked around if those paths are in the script.
