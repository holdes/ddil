# DDIL Demo Audit — real / fake / legacy + Elastic-native assessment

Audited 2026-11-20 against the **live** `ddil-vineyard` cluster (9.5.5) and the actual
code (git `~/ddil` + the diverged live `~/demo` on .10), not docs. Three parallel
investigations: AI-search backend architecture, Elastic wiring inventory, and the
space-cyber/ops comparison.

## Executive verdict: a two-speed architecture

The kit is **two demos wearing one brand**, and they could not be more different in how
they use Elastic:

- **Security / space-cyber side = a genuine Elastic-native agentic showcase.** Deployed
  Agent Builder agents grounded on `index_search` KB tools, **11 live Elastic Workflows**
  including an **alert-triggered triage workflow that calls an agent as a workflow step**
  (`type: ai.agent` → opens a case → writes the agent's verdict back), and a
  **chat→agent→`type:workflow` tool→`.webhook`→COSMOS→real hardware** commanding path with
  **zero Python in the runtime loop**. 97 enabled detection rules, 49 ML jobs *opened and
  processing real volume*, 923 alerts actually fired, telemetry ingesting *right now*.
- **AI-search side ("Choose Your Adventure") = mostly a hand-rolled Python harness** that
  *imitates* an agent. Of four adventures, exactly **one (SEC/Finance) delegates to Agent
  Builder**. The flagship **vineyard "AI Agronomist" is not an agent** — it's a 5-phase
  Python state machine with fake progress, mocked fallbacks, and string-scraped JSON.

**The irony:** a real `vineyard-advisor` Agent Builder agent **with 5 ES|QL tools already
exists in Kibana** — and nothing calls it. The backend reimplements a worse version of it
in Python right next to it.

## Real / fake / legacy ledger

### AI-search demos

| Demo | Verdict | Detail |
|---|---|---|
| **Vineyard agronomist** | 🟠 **HARNESS + STAGED** | `chat.py:41-201` is a hand-orchestrated 5-phase pipeline. **Fake 3s "heartbeat" messages** that query nothing (`chat.py:107-166`); **hardcoded variety dict** (`:96-101`); phase2-4 are plain `invoke_llm_json` completions over hand-written prompts (`prompts.py`) with **brace-scraped JSON** (`llm.py:187-227`). phase0 real ES but **silent mock fallback** to canned BLK-C on any error (`phase0:82-84`); phase1 real kNN but the **query vector is fabricated from constants** (`phase1:35-44`) and falls back to canned 2020/2022 records. No tools, no tool-calling, no Agent Builder. |
| **SEC / Finance** | 🟢 **ELASTIC-NATIVE** | The only adventure that uses Agent Builder: `finance.py:179-230` is a thin SSE proxy to `/api/agent_builder/converse/async`, agent `finance-analyst` + 3 custom ES|QL tools + the Nemotron/vLLM connector, provisioned by `demo/scripts/finance/`. Search is real native kNN on `sec_10k_2026`. |
| **Jina multimodal + DLS** | 🟢 retrieval / 🟠 analyst | **Best native retrieval in the kit:** `multimodal/search` uses `query_vector_builder` so **ES self-embeds the query** (`jina.py:91-98`); `search` uses RRF retrievers + collapse + real DLS (`terms_set`/NOFORN, `jina_dls.py`). But the **"Research Paper Analyst" is hand-rolled RAG** — stuff passages → `invoke_llm` plain completion, citations enforced only by prompt text (`jina.py:244-325`). |
| **CCS edge federation** | 🟢 **REAL** / ⚠️ diverged | Genuine cross-cluster orchestration (`PUT _cluster/settings` remote, `_remote/info` guard). **But git and the live kit implement OPPOSITE directions** — git = box-coordinates-outbound (new), live `.10` = ECH-coordinates-the-box (old). A redeploy changes behavior. |
| **GPU indexing "race"** | 🔴 **FAKE** | `indexer.py` is 100% simulation — `asyncio.sleep(0.5)` loops + gaussian-noise throughput, outcome hardcoded (GPU 28.5k v/s vs CPU 4.2k). **No ES call, nothing indexed, no GPU.** (Doubly ironic now that cuVS GPU indexing *actually works* post-9.5.5 cutover — the race could be made real.) |

### Mocks / dead code (AI-search backend)

- 🔴 `images.py` — CLIP stub returning canned "Black Rot 0.942".
- 🔴 `sensors.py` — `_mock_update()` random-walk; no Modbus.
- 🔴 `search.py` — returns hardcoded `mock-1/mock-2` hits on any ES error.
- 🧟 `pipeline.py` `run_pipeline()` — a second, sequential copy of the vineyard pipeline, **never imported**.
- 🧟 `rag.py` + `/api/chat` — older RAG path with a mismatched "USDA Cook Farm" prompt; superseded.
- 🧟 Live-only: Bedrock/`gpt-oss:120b` config remnants (git already removed Bedrock, defaults vLLM/Nemotron).

### Elastic artifacts (from the wiring inventory)

| Artifact | Verdict |
|---|---|
| `finance-analyst` agent + `finance.*` ES\|QL tools | 🟢 real-used |
| `spacecyberanalyst`, `spacecyberdetectioneng` + `spartastixkb`/`spacecyberkb` KB tools | 🟢 real-used |
| 9 `payload_*` servo/LED `type:workflow` tools + `sparta-any-alert-case-manager-2` | 🟢 real-used |
| **`vineyard-advisor` agent + 5 `vineyard-*` ES\|QL tools** | 🟠 **ORPHANED** — exist in Kibana, no provisioning script, **no caller** |
| `spacecyberanalyst-lean` (test), `mech-set-led-agent-tool` (prototype) | 🧟 legacy |
| Inference endpoints `ollama-chat`(gpt-oss:120b), `ollama-qwen`, `ollama-gemma4`, `ollama-llama`, `llama31-8b`, `ollama-embeddings` | 🧟 benchmarking residue, orphaned |
| Connectors: COSMOS webhook 🟢, Nemotron vLLM 🟢, Ollama Qwen3 🟠 fallback | mixed |

## Elastic-native scorecard

| Capability | Security / Ops | AI-search |
|---|---|---|
| Agent Builder agents | ✅ 2 deployed, KB-grounded | ✅ 2 deployed (**1 orphaned**) |
| Custom ES\|QL / index_search tools | ✅ | ✅ (same pattern) |
| **Elastic Workflows** | ✅ **11 live** | ❌ none |
| **Agent-as-workflow-step** (`ai.agent`) | ✅ alert → agent → case | ❌ none |
| **Tool-calling into actions** (`type:workflow` → `.webhook`) | ✅ chat → hardware | ❌ tools read-only Q&A |
| Automated response (cases, write-back, dedup) | ✅ | ❌ none |
| ML anomaly + detection layer | ✅ 49 jobs / 97 rules / 923 alerts | ❌ none over vineyard data |

## Recommendations (highest leverage first)

1. **Make the vineyard agronomist a real agent.** Wire the backend to the *already-existing*
   `vineyard-advisor` Agent Builder agent + its 5 ES|QL tools (proxy pattern from
   `finance.py`), and **delete** `phase0-4`, `prompts.py`, the fake heartbeats, the hardcoded
   variety map, and the brace-scraped JSON. This replaces ~600 lines of harness with the
   Elastic-native pattern you *already built and left unused*.
2. **Give the AI-search agents actions, not just answers.** Copy the security kit's
   `type:workflow` tool pattern: a vineyard agent tool that *acts* (dispatch an irrigation
   task, generate+store a report) via Workflow → `.webhook`, gated by `confirmation.askUser`.
3. **Add an event-triggered Workflow that calls the agent** (mirror
   `sparta_any_alert_case_manager.yaml`): a sensor-threshold trigger → `type: ai.agent`
   `vineyard-advisor` diagnoses → writes a case/report. The single biggest native capability
   the AI-search side lacks.
4. **Ground the analyst/agronomist on an `index_search` KB tool** (like `spartastixkb`) for
   "invent nothing" retrieval instead of free-form completion — fixes the Jina analyst too.
5. **Add an ML/detection layer over vineyard sensors** — the security side's 49 jobs / 923
   alerts show the pattern; the AI-search side has none.
6. **Make the GPU race real** — now that cuVS GPU indexing works on 9.5.5, replace
   `indexer.py`'s simulation with an actual timed bulk-index GPU-vs-CPU comparison.
7. **Replace silent mock fallbacks with visible failure** — `phase0`/`phase1`/`search.py`
   canned-data-on-error can make a dead backend look live on stage.

## Cleanup backlog

Delete/retire: `pipeline.py`, `rag.py`+`/api/chat`, `images.py`, `sensors.py` mock,
`search.py` mock fallback; orphaned `vineyard-advisor`→(or wire it per #1);
`spacecyberanalyst-lean`, `mech-set-led-agent-tool`; the 6 legacy Ollama inference endpoints;
reconcile live `~/demo` ↔ git (CCS direction + the pre-vLLM Bedrock/gpt-oss generation).
