# PiSat → Elastic shipper

Filebeat + Logstash configuration that streams the PiSat Zeek CCSDS feed and the
access-portal log into Elastic.

```
shipper/
├── logstash-pisat.conf         Logstash pipeline (classify + normalize + output)
├── filebeat-pisat-inputs.yml   Filebeat inputs
├── dictionaries/               enum decode tables (cs_state, hs_state, mm_lastaction, mm_memtype)
└── README.md
```

## Data lanes

| `pipeline_source` | Source | Lands in |
|---|---|---|
| `zeek-ccsds` | `ccsds_commands.log` + `ccsds_telemetry.log` (one input) | `logs.ecs.spacecraft.commands` / `.memory` / `.health` / `.events` **and** `logs-pisat-telemetry` |
| `zeek-conn` | `conn.log` | `logs-zeek.connection` |
| `pisat-portal` | portal access log | `logs-pisat-portal` |

Both Zeek CCSDS logs ship under the single `zeek-ccsds` input. The pipeline splits
by content — a command record carries `command_name` (and gets `command.name`/`command.opcode`
set for the hazardous-command rule), a telemetry record carries `packet_name`. The decoded
**state** packets route to the wired-stream partitions:

| Packet | Lands in | Normalized fields |
|---|---|---|
| `CS_HKPACKET` | `.memory` | `cs.checksumState`, `cs.eepromState`, `cs.memoryState` |
| `MM_HKPACKET` | `.memory` | `mm.lastAction`, `mm.memType`, `mm.address`, `subtype` |
| `HS_HKPACKET` | `.health` | `hs.cpuHogState`, `hs.statusFlags` |
| `SPACECOP_REPORT_TLM` | `.events` | `message` (from `IDS_MSG`), `target_name` |

**Nothing is dropped.** EVERY telemetry packet — including the numeric gauge housekeeping
(`EPS_HK_TLM`, `SYSMON_HK_TLM`, `CAMERA_HK_TLM`, …) — also lands in **`logs-pisat-telemetry`**
with its `parameters.*` typed as numbers, so the abnormal-telemetry ML jobs can model it.

## Portal registration lane

The portal access log lands in `logs-pisat-portal` with an ECS `authentication`
overlay: `user.name` (from `email`), `source.ip` (from `ip`), `service.name`,
`event.category=authentication`, `event.action=login`/`register`. Commands ship as
plain wire docs with no `user.name`.

## Install

1. **Dictionaries.** Copy `dictionaries/` to the Logstash host and point the pipeline at it:
   ```
   echo 'DICT_DIR=/etc/logstash/pisat/dictionaries' | sudo tee -a /etc/logstash/logstash.yml.env
   ```

2. **Logstash.** Install `logstash-pisat.conf` (e.g. `/etc/logstash/conf.d/`) and set:
   - `ELASTIC_HOST` — the Elastic endpoint
   - `api_key` — `API_KEY_ID:API_KEY_SECRET`

   The API key needs **create** on `logs.ecs*`, `logs-zeek.connection*`,
   `logs-pisat-portal`, and `logs-pisat-telemetry`. `action => "create"` on the outputs
   is required.

3. **Filebeat.** Add the inputs from `filebeat-pisat-inputs.yml` to
   `/etc/filebeat/filebeat.yml`. Set the portal-log path to where the access portal
   writes its log.

4. **Restart.**
   ```
   sudo filebeat test output
   sudo systemctl restart filebeat logstash
   ```

## Verify

```
GET logs.ecs.spacecraft.commands/_search  { "query": { "range": { "@timestamp": { "gte": "now-15m" }}}}
GET logs.ecs.spacecraft.memory/_search    { "query": { "term": { "fswApp": "CS" }}}
GET logs-pisat-portal/_search             { "query": { "match_all": {} }}
```

Command docs carry `source.ip`, `target_name`, `command.name`; memory docs carry
`cs.checksumState` as a word (`ENABLED`/`DISABLED`); portal docs carry the ECS
`authentication` fields above.

## Dictionaries

`dictionaries/*.json` decode raw integer telemetry states to labels
(`CHECKSUMSTATE "2" → DISABLED`), generated from the pisat flight-software source.
Regenerate with `python -m cluster.build_logstash` if a flight-software enum changes.
