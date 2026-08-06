# DEFCON PiSat — Elastic integration

Streams the PiSat ground station's data into Elastic and runs a curated set of SPARTA
analytics on it. Two parts, both driven by the project `.env`:

1. **The shipper** (`shipper/`) — Filebeat + a Logstash pipeline on the ground-station
   host that normalizes the feed and sends it to Elastic.
2. **The cluster config** (`defcon_cluster_config_main.py`) — one command that deploys
   the DEFCON analytics into the cluster.

Everything comes from the decoded Zeek CCSDS feed plus the access-portal log — no
microservices, no OpenC3 changes. The data conforms to the **existing core partitions**;
this integration creates no spacecraft partitions of its own.

| Lane | Source | `pipeline_source` | Elastic destination |
|------|--------|-------------------|---------------------|
| Commands + telemetry | Zeek `ccsds_commands.log` + `ccsds_telemetry.log` (one input) | `zeek-ccsds` | `logs.ecs.spacecraft.commands` / `.memory` / `.health` / `.events` **and** `logs-pisat-telemetry` |
| Network | Zeek `conn.log` | `zeek-conn` | `logs-zeek.connection` |
| Portal registration | access-portal log | `pisat-portal` | `logs-pisat-portal` |

## The shipper (`shipper/`)

Both Zeek CCSDS logs ship under a single `zeek-ccsds` input; the Logstash pipeline splits
command vs. telemetry by content (`command_name` vs. `packet_name`) and normalizes each lane
to the fields the analytics read — `command.name`, `source.ip`, `target_name`,
`cs.checksumState`, `hs.cpuHogState`, `mm.*`, `message` — decoding the raw integer telemetry
states to labels with dictionaries generated from the flight-software source. Telemetry routes
by packet name: `CS_HKPACKET`/`MM_HKPACKET` → `.memory`, `HS_HKPACKET` → `.health`,
`SPACECOP_REPORT_TLM` → `.events`. **Nothing is dropped** — every telemetry packet (including
the numeric gauge housekeeping) also lands in `logs-pisat-telemetry` with numeric-typed
`parameters.*` for the abnormal-telemetry ML. See `shipper/README.md`.

## Attribution

Every attendee drives one shared COSMOS entity, so commands are **not** attributed at ingest.
The access-portal registration log lands in `logs-pisat-portal` with an ECS `authentication`
overlay (`user.name`, `source.ip`, `service.name`, `event.category=authentication`,
`event.action=login`/`register`). Attribution is performed at **query time by the AI agent**,
which uses that index as context (e.g. the most recently registered user). Commands ship as
plain wire docs with no `user.name`.

## Grounding

Every telemetry decode value (`CHECKSUMSTATE 2 → DISABLED`, `LASTACTION 2 → POKE`, …) is
traced to the flight-software source (`the-aerospace-corporation/spacecop-demo`), held in
`cluster/decode_maps.py`; the Logstash dictionaries are generated from it
(`cluster/build_logstash.py`) so they cannot drift.

## Deploy the cluster config

**Prerequisites:** (1) create the project `.env` from `.env.example` and fill in
`ES_URL` / `ES_APIKEY` / `KIBANA_URL` / `KIBANA_APIKEY`; (2) run with the project
**virtualenv** (`.venv/bin/python`); (3) the **core baseline must be deployed first**
(`python main.py` from the project root). The preflight checks all three.

`defcon_cluster_config_main.py` is the one entry point for the DEFCON layer. From
`demodocs/defcon-pisat/`:

```
python defcon_cluster_config_main.py                deploy the DEFCON config (+ seed demo data)
python defcon_cluster_config_main.py --config-only  deploy without seeding demo data (for live)
python defcon_cluster_config_main.py --teardown     remove everything it created
```

It ensures the shared core `ref-hazardous-command` lookup, optionally seeds demo data
(including a benign 5-day command baseline + telemetry into `logs-pisat-telemetry`), and
deploys the ML jobs + the `defcon-*` rules. The full rule set is written to `rules/` (ES|QL +
ML) and the anomaly-job configs to `ml_jobs/` — see `CLUSTER_CONFIG.md`. Alongside the
command rules it deploys **20 abnormal-telemetry ML jobs** (`defcon-tlm-*`) across the payloads.
Everything it adds is namespaced — `defcon-*` rules (incl. `defcon-tlm-*-ml` + `defcon-uace4-ml`),
the `defcon-insider-rare-command` + `defcon-tlm-*` ML jobs, demo data by `pipeline_source`, and
the `logs-pisat-portal` + `logs-pisat-telemetry` indices — so `--teardown` is exact and
preserves all core data and the shared lookup.
