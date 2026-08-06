# DEFCON PiSat — cluster configuration

**`defcon_cluster_config_main.py` is the one entry point to deploy the DEFCON-scoped
config.** It is DEFCON-scoped only — the core/baseline schema + analytics are deployed
separately by the project's `main.py` and are a **prerequisite** (this pack conforms to
the core partitions). Both scripts read the same project `.env` (`ES_URL` / `ES_APIKEY`
/ `KIBANA_URL` / `KIBANA_APIKEY`). A preflight check confirms the connection and that
the core is deployed before it does anything.

```
python defcon_cluster_config_main.py                deploy the DEFCON config (+ seed demo data)
python defcon_cluster_config_main.py --config-only  deploy without seeding demo data (for live)
python defcon_cluster_config_main.py --teardown     remove everything it created
```

## No partitions of its own

The pisat data comes from the decoded Zeek feed + the access-portal log (no
microservices), and conforms to the **existing core partitions** by `event.dataset`:

| Data | Partition |
|------|-----------|
| commands (wire frame) | `logs.ecs.spacecraft.commands` |
| memory / checksum telemetry | `logs.ecs.spacecraft.memory` |
| health telemetry | `logs.ecs.spacecraft.health` |
| on-board IDS (SPACECOP) alerts | `logs.ecs.spacecraft.events` |
| portal registration log (agent attribution context) | `logs-pisat-portal` (own data stream) |
| numeric telemetry — every packet, ML store | `logs-pisat-telemetry` (own index) |

Hazardous-command classification uses the shared **core** `ref-hazardous-command`
lookup (grounded in `payload_generators/config.py::HAZARDOUS_COMMANDS` — cFS app
command semantics). Deploy ensures it exists; teardown never removes it.

Attribution: everyone commands through one shared COSMOS entity, so commands are not
attributed at ingest. The portal registration log is captured — with an ECS
authentication overlay — in `logs-pisat-portal`; the AI agent performs attribution at
query time from that index (see `shipper/`).

## The analytics

The decoded Zeek feed provides commands + telemetry + SPACECOP IDS — a single set of
rules covers everything:

| Rule | Fires on |
|------|----------|
| `defcon-mire7-esql` | hazardous command (matched to the core `ref-hazardous-command` catalog) |
| `defcon-uace9-esql` | command flooding from one source |
| `defcon-siuu2-esql` | on-board SPACECOP IDS alert |
| `defcon-mire2-esql` | integrity monitoring disabled (effect) |
| `defcon-smsr2-esql` | CPU-hog / processor stress (effect) |
| `defcon-mire2-corr` | disable command **and** its confirmed on-board effect |
| `defcon-uace4-ml` | population `rare` command (ML job `defcon-insider-rare-command`) |

**Abnormal telemetry (ML).** 20 anomaly-detection jobs on `logs-pisat-telemetry`, one per
security-relevant metric across the payloads — EPS power, SYSMON host resources, HS/CFE_ES
resets + CPU, CS memory/EEPROM integrity, CFE_SB/CI command-error surges, STPYLD attitude/IMU +
thermal, CAMERA/DS exfil signals, SPACECOP IDS health — each bound to a `defcon-tlm-*-ml` rule.
They score the EFFECT of an attack in the housekeeping telemetry regardless of who commanded,
so they catch what the command rules miss. Every field is grounded in the pisat telemetry
dictionary (`spacecop-demo` `cosmos_definitions.json`).

Plus the Zeek `conn.log` lane feeds Elastic's prebuilt Zeek network detections (the
integration ingest pipeline builds full ECS).

## Naming & grounding

Every rule follows the project convention: `name` is the primary SPARTA IOB's
verbatim STIX name (`MIRE-7: Unexpected Memory Value Write or Modification`),
carries the IOB number and technique in tags + the `sparta` provenance block, and
a structured investigation-guide note. Nothing is invented — every field/value
traces to the pisat COSMOS definitions, the core schema, or cFS command semantics.

## Teardown scope

Removes exactly what it created — the `defcon-*` rules (including the `defcon-tlm-*-ml`
telemetry rules + `defcon-uace4-ml`), the `defcon-insider-rare-command` command ML job and the
20 `defcon-tlm-*` telemetry ML jobs, the seeded demo docs (by `pipeline_source`), and the
`logs-pisat-portal` + `logs-pisat-telemetry` indices. It touches **no** core data, core
partitions, or the shared `ref-hazardous-command` lookup.
