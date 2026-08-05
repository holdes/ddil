# Data flow — satellite to alert, hop by hop

Every network hop, every transformation, and everything the vehicle can emit.
Grounded in `reference/cosmos-targets/` (the authoritative wire layouts), the
`spacecop-demo` flight software, the `space_cyber_security` schema, and the live
packet samples in the "PiSat logs" mail thread.

Written 5 Aug 2026. Where something is inferred rather than observed it says so.

---

## 0. The whole path in one picture

```
  ┌──────────────────────────────────────────────────────────────────┐
  │ SPACECRAFT                                                       │
  │   cFS apps ──► Software Bus ──► TO_LAB ──► UDP socket            │
  │   EPS SYSMON CAMERA STPYLD SPACECOP CS MM HS LC SC DS FM ...     │
  └───────────────────────────┬──────────────────────────────────────┘
             telemetry 5013   │   ▲   commands 5012
                              ▼   │
  ┌──────────────────────────────────────────────────────────────────┐
  │ GROUND STATION  (Pi 5, "groundation")                            │
  │                                                                  │
  │   ┌─ OpenC3 COSMOS ── UDP interface ─ decommutates ─ operator UI │
  │   │                                                              │
  │   └─ Zeek ── passive tap on the same traffic ──┐                 │
  │        writes ccsds_commands.log               │                 │
  │               ccsds_telemetry.log              │                 │
  │                                                ▼                 │
  │      Filebeat ─── conn.log, portal auth log ───► Logstash        │
  └───────────────────────────┬──────────────────────────────────────┘
                              │  NDJSON over TCP
                              ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ ELASTIC  (the DDIL kit)                                          │
  │   logs.ecs  ──routing──►  logs.ecs.spacecraft.commands           │
  │                    Streams Processing = ECS overlay              │
  │                              │                                   │
  │                              ▼                                   │
  │            SPARTA detections ──► alert ──► operator              │
  └───────────────────────────┬──────────────────────────────────────┘
                              │  the loop closes: a command goes back up
                              ▼
                    the wings move on the table
```

---

## 1. Hop 0 — inside the spacecraft

Nothing is on the network yet. cFS apps publish to the **Software Bus**, an
in-process pub/sub keyed by message ID. `TO_LAB` subscribes to what should be
downlinked and pushes it out of a UDP socket; `CI_LAB` receives commands and
republishes them onto the bus for the owning app.

This matters for one reason: **a packet on the wire has already been through the
Software Bus, so its message ID is the routing key end to end.** The APID you see
in Zeek is the same number the flight app published under.

---

## 2. What the vehicle can emit — the complete inventory

**41 telemetry packets, 254 commands, across 19 targets.** Counted from
`reference/cosmos-targets/`.

### 2.1 The custom apps — what this demo is about

| APID | Packet | Contents |
|---|---|---|
| `0x09AA` | `EPS_HK_TLM` | power |
| `0x09CA` | `SYSMON_HK_TLM` | host health |
| `0x09BA` | `STPYLD_HK_TLM` | science payload |
| `0x09DA` | `CAMERA_HK_TLM` | imager |
| `0x08FD` | `SPACECOP_REPORT_TLM` | **on-board IDS detections** |
| `0x08FE` | `SPACECOP_HK_TLM` | IDS counters |

**`EPS_HK_TLM` (0x09AA)** — 95 bytes, the only packet verified byte-for-byte.
`CommandErrorCount`, `CommandCount`, `ErrorCount`, then `voltage[8]`,
`currant_ma[8]` *(sic)*, `present[8]`, `SensorCount`, `Spare[3]`.

The eight slots are **not** in an obvious order. COSMOS names them:

```
index:  0        1        2        3       4        5        6        7
panel:  R        B        Battery  Blank   T        L        F        U
```

So `RSolarPanelV`, `BSolarPanelV`, `BatteryV`, `BlankV`, `TSolarPanelV`,
`LSolarPanelV`, `FSolarPanelV`, `USolarPanelV`, and the same order again for
`*Ma` and `*P`. **Take this from `reference/cosmos-targets/EPS/cmd_tlm/tlm.txt`,
never from the C struct** — the struct is just `float voltage[8]` and gives no
hint which slot is which panel.

**`SYSMON_HK_TLM` (0x09CA)** — `UptimeSeconds`, `CPUTempC`, `CPULoadPercent`,
`TotalMemoryKB`, `FreeMemoryKB`, `DiskTotalMB`, `DiskFreeMB`. Ordinary host
telemetry, and the most useful lane for anomaly detection because it moves.

**`STPYLD_HK_TLM` (0x09BA)** — `PayloadValid`, `BMEValid`, `ImuValid`,
`GPSValid`, `Temperature`, `Pressure`, `Altitude`, `Humidity`, `GyroX/Y/Z`,
`AccelX/Y/Z`, `GPSVal1/2/3`. The `*Valid` flags are **booleans, 1 or 0** —
confirmed by the Aerospace lead, and the reason no enum dictionary is needed for
them.

**`CAMERA_HK_TLM` (0x09DA)** — `ImageCounter`, `CameraAvailable`,
`CaptureInProgress`, `LastCaptureStatus`, `LastImagePath` (1024-bit string),
`LastImageSizeBytes`, `LastCaptureUnixTime`, `LastDeleteStatus`. Also booleans.
`CameraAvailable` is why a broken CSI ribbon degrades rather than breaks the demo.

**`SPACECOP_REPORT_TLM` (0x08FD)** — the interesting one. After the 16-byte
header there is exactly one field:

```
IDS_MSG   8192 bits   STRING     # 1024 bytes
```

A 1 KB string carrying the on-board IDS finding, STIX-formatted. SpaceCop builds
it from a 238-entry SPARTA Indicator-of-Behavior database across ten categories
(UACE, UCEB, CSNE, ARFS, GNTM, MIRE, WTRE, SIUU, SMSR, DISE), fed by command
monitors, file-integrity and process monitoring, and a syscall-intercepting Linux
kernel module (`aerospace.ko`).

**This is the vehicle reporting its own compromise, over the same downlink as
housekeeping.** It is also, therefore, a channel an attacker who owns the vehicle
can lie on — which is exactly why the ground-side wire tap exists.

### 2.2 The standard cFS apps — the detection surface

Everything below is stock cFS, and it is where the *ground-side* detections
actually bite, because these commands change the spacecraft's safety posture.

| APID | Packet | | APID | Packet |
|---|---|---|---|---|
| `0x0800` | `CFE_ES_HKPACKET` | | `0x08A4` | `CS_HKPACKET` |
| `0x0801` | `CFE_EVS_TLMPKT` | | `0x08A7` | `LC_HKPACKET` |
| `0x0803` | `CFE_SB_HKMSG` | | `0x08AA` | `SC_HKTLM` |
| `0x0804` | `CFE_TBL_HKPACKET` | | `0x08AD` | `HS_HKPACKET` |
| `0x0805` | `CFE_TIME_HKPACKET` | | `0x08B8` | `DS_HKPACKET` |
| `0x0806` | `CFE_TIME_DIAGPACKET` | | `0x08B9` | `DS_FILEINFOPKT` |
| `0x0808` | `CFE_EVS_PACKET` | | `0x0887` | `MM_HKPACKET` |
| `0x080A` | `CFE_SB_STATMSG` | | `0x0890` | `MD_HKTLM` |
| `0x080B` | `CFE_ES_ONEAPPTLM` | | `0x0891` | `MD_DWELLPKT` |
| `0x080C` | `CFE_TBL_TBLREGPACKET` | | `0x0897` | `SCH_HKPACKET` |
| `0x080D` | `CFE_SB_PREVSUBMSG` | | `0x0898` | `SCH_DIAGPACKET` |
| `0x080E` | `CFE_SB_SUBRPRTMSG` | | `0x089B` | `HK_HKPACKET` |
| `0x080F` | `CFE_ES_SHELLPACKET` | | `0x089C` | `CFE_HK_COMBINED_PKT1` |
| `0x0810` | `CFE_ES_POOLSTATSTLM` | | `0x088A–E` | `FM_*` (5 packets) |
| `0x0880` | `TO_DEBUG_HKPACKET` | | `0x08E0` | `CI_DEBUG_HKPACKET` |

Command counts per target: `CFE` 84, `CS` 40, `FM` 20, `DS` 18, `SC` 18, `MM` 13,
`HS` 12, `LC` 7, `SCH` 8, `CFDP` 6, `MD` 6, `CAMERA` 5, `SPACECOP` 4, `EPS` 3,
`STPYLD` 3, `SYSMON` 3, `TO_LAB` 3, `CI_LAB` 2, `HK` 2.

**`CFE_ES_SHELLPACKET` (0x080F) deserves a stare.** cFE Executive Services can
run a shell command and return the output as telemetry. On a spacecraft.

### 2.3 Commands worth watching

The custom apps are dull: `NOOP`, `RESET_CTRS`, `*_REQUEST_HK_CC`, plus
`TAKE_PIC` / `DELETE_LAST` on CAMERA and `SPACECOP_REQUEST_IDS_CC`.

The dangerous ones are stock cFS, and they are what **SMSR-6** keys on:

```
HS_DISABLE_APPMON      HS_DISABLE_EVENTMON
HS_DISABLE_CPUHOG      HS_DISABLE_ALIVENESS
LC_SET_AP_PERMOFF      LC_SET_LC_STATE
```

Health & Safety and Limit Checker are the watchdogs. Turning them off is what you
do *before* you do something the watchdog would catch. **All six literals exist in
the pisat's 1,025-name dictionary** — verified — so that rule fires on this
vehicle unmodified even though it was written for NOS3.

---

## 3. Hop 1 — spacecraft to ground

Plain UDP over WiFi. No SDLS, no encryption, no authentication — `AUTH ... NONE
— BY PROTOCOL`, as the operational picture puts it. That is realistic: a great
deal of real spacecraft traffic is exactly this exposed.

| | Direction | Port | Observed |
|---|---|---|---|
| **Telemetry** | vehicle → ground | **UDP 5013** | `10.13.37.1:5013 → 10.13.37.9:5013` |
| **Commands** | ground → vehicle | **UDP 5012** | `10.13.37.42:51000 → 10.13.37.1:5012` |

So in the sample capture: `.1` is the spacecraft, `.9` is the ground station,
`.42` is the operator's command source. Venue addressing will differ.

**These ports were wrong in earlier documentation and in the operational-picture
SVG** (TM 5012 / TC 5013). Four independent confirmations of the correct
assignment: `pisat_sim.py`, the Zeek analyzer header, the live captures above, and
the COSMOS plugin's interface line —

```
INTERFACE PISAT_INT openc3/interfaces/udp_interface.rb <target_ip> 5012 5013 ...
                                          write-dest ──┘    └── read
```

### Packet framing

16-byte header. **The endianness changes mid-header**, which is the single most
common way to decode plausible-looking garbage:

| Offset | Size | Field | Endian |
|---|---|---|---|
| 0 | 2 | `CCSDS_STREAMID` | **BIG** |
| 2 | 2 | `CCSDS_SEQUENCE` | **BIG** |
| 4 | 2 | `CCSDS_LENGTH` | **BIG** |
| 6 | 4 | `CCSDS_SECONDS` | **BIG** |
| 10 | 2 | `CCSDS_SUBSECS` | **BIG** |
| 12 | 4 | `CCSDS_SPARE` | **LITTLE** |
| 16 | … | body | **LITTLE** |

`CCSDS_STREAMID` decomposes into version (3 bits), type (1 — **1 = command,
0 = telemetry**), secondary-header flag (1), and **APID (11 bits)**.

### ⚠️ The length field is not standard on telemetry

CCSDS says the length field is `total - 7`. Commands obey it: 136-byte packet,
LENGTH 129. **EPS telemetry does not** — 95 bytes, LENGTH 85, i.e. `total - 10`.
Three short, and three is exactly `sizeof(spare[3])`. The flight software computes
the length without those bytes and transmits them anyway.

`flight/ccsds.py` reproduces this deliberately. Anything we emit must match the
real vehicle, not the standard, or it decodes differently.

---

## 4. Hop 2 — the ground station

Two consumers of the same traffic, doing different jobs.

### 4.1 COSMOS — the operator's view

One UDP interface, 19 targets mapped onto it, decommutating packets into named
fields using `reference/cosmos-targets/`. This is what a human watches.

**Multiple vehicles:** install the plugin twice. Every target name and
`target_ip` is already a `VARIABLE`. Only `INTERFACE PISAT_INT` is hardcoded and
needs to become one — in **our** copy, never theirs. Ours becomes `DEMOSAT_*` /
`DEMOSAT_INT`; Aerospace's stays default.

### 4.2 Zeek — the wire tap

Passive. Nothing is installed on the spacecraft. `ccsds_full_analyzer.zeek`
decodes CCSDS off the link and writes two JSON logs:

```
/opt/zeek/logs/current/ccsds_commands.log
/opt/zeek/logs/current/ccsds_telemetry.log
```

**This is the architectural point of the whole demo.** Detection works against a
vehicle you do not control and cannot instrument. A compromised spacecraft can lie
in `SPACECOP_REPORT_TLM`; it cannot lie about the bytes on the wire.

### 4.3 What Zeek actually emits

⚠️ **The analyzer in the repo — and in `reference/` — is STALE.** It decodes
headers only. The live one also decodes **parameters**, and that fix was never
pushed. Use the mail samples.

**`ccsds_commands`:**

```
ts uid src_ip src_port dst_ip dst_port
stream_id stream_id_hex apid sequence_flags packet_sequence data_length
function_code checksum
target command_name command_desc
raw_hex packet_length valid error
parameters.*        ← the live decode
```

Real sample:

```json
"dst_port": 5012, "stream_id_hex": "0x185a", "apid": 90,
"function_code": 29, "target": "CFDP",
"command_name": "DOWNLOAD_FROM_SATELLITE_CC",
"parameters.CCSDS_FC": "29",
"parameters.SOURCE": "/cf/img/photo.jpg",
"parameters.DESTINATION": "photo.jpg"
```

**`ccsds_telemetry`:** same minus `function_code`/`checksum`, plus `packet_name`
and `packet_desc`. A real EPS sample carries the full housekeeping set as
`parameters.BatteryV`, `parameters.RSolarPanelP`, `parameters.CommandCount`…

**Everything decodes to strings**, including numerics — `"1"`, `"3.700000"`. That
is what the Logstash enum dictionaries are for: turning `CHECKSUMSTATE: "1"` into
`ENABLED` so detections key on meaning rather than magic numbers.

---

## 5. Hop 3–5 — ground station to Elastic

**Four lanes**, per the Elastic-side shipper:

| Lane | Source | Why |
|---|---|---|
| CCSDS commands | `ccsds_commands.log` | the detection surface |
| CCSDS telemetry | `ccsds_telemetry.log` | vehicle state |
| Network flow | Zeek `conn.log` | who talked to whom |
| Portal auth | pisat portal log | **operator attribution** |

The portal log is `{"ts", "service": "pisat-portal", "event": "LOGIN"|"REGISTER",
"email", "ip"}`. Since only one operator is active at a time, commands are
attributed by lining the login timeline up against the command timeline — the
active session owns the commands. That is how a wire frame acquires a `user.name`
it does not carry.

Filebeat tails all four → Logstash normalises and applies the dictionaries →
Elasticsearch.

### ⚠️ OPEN RISK — the write path may silently do nothing

The Logstash output is:

```
index => "logs.ecs"     # a wired stream
action => "create"
data_stream => false
```

The schema's own ingest documentation says:

> Use `stream_bulk` … **not** the regular Elasticsearch `_bulk` API. `es_bulk`
> bypasses the wired-stream layer and writes directly to the backing data stream
> — documents are not partition-routed and do not run the processing chain.

Logstash's elasticsearch output writes through `_bulk`. If that bypasses the
wired-stream layer, **data lands looking perfectly healthy in Discover while
skipping partition routing and the entire ECS overlay** — and no detection can
fire. Nothing errors. Nothing warns.

**`flight/check_stream_route.sh` settles it in two minutes.** Run it before
trusting anything downstream.

Also: the schema targets **9.4+ or Serverless**; the kit is on **9.3.1**.

---

## 6. Hop 6 — the ECS translation

Everything lands on `logs.ecs`, stamped `event.module` / `event.dataset`, and
Streams Processing routes it to a child partition and applies the ECS overlay
server-side. Nothing client-side renames fields — Logstash's job is to deliver
wire-shaped JSON, not to do ECS.

Target: **`logs.ecs.spacecraft.commands`**, `event.dataset: space.command`.

That partition was specified for **two feeds sharing one shape** — the COSMOS
command-ops record, and *"the wire frame captured at the Command Ingest boundary
… including frames with no command-ops record."* **The Zeek feed is the second
one.** The slot was cut for it and never wired up.

### Field mapping

| Zeek | ECS / partition field | Note |
|---|---|---|
| `ts` | `@timestamp` | |
| `stream_id` | `primaryHeader.version` / `.type` / `.secondaryHeaderFlag` / `.apid` | all four decode out of the 16-bit word |
| `sequence_flags` | `primaryHeader.sequenceFlags` | |
| `packet_sequence` | `primaryHeader.sequenceCount` | |
| `data_length` | `primaryHeader.packetDataLength` | |
| `function_code` | `command.opcode` | the schema states this *is* `CCSDS_FC` |
| `command_name` | `command.name` | |
| `target` | `target_name` → `service.name` | via the `subsystem-by-target` enrich policy |
| `src_ip` / `dst_ip` | `source.ip` / `destination.ip` | |
| `valid` / `error` | `event.outcome` | |
| `parameters.*` | `cmd_params.*` | Streams auto-flattens to dotted keyword paths |
| *(absent)* `cosmos.scope` | — | **the injection signal** |

**Type discipline matters.** CCSDS bit-width is not the Elasticsearch type:
Elasticsearch `byte` is *signed* 8-bit, max 127, so a 14-bit `sequenceCount` of
8247 fails ingest. Use `byte` ≤ 7 bits, `short` ≤ 15, `integer` ≤ 31.

### ⚠️ Two vehicles will trip a false positive

`spacecraft.id` derives from `cosmos.scope`, which wire frames do not carry — so
it is **null** for all Zeek-sourced traffic. Two spacecraft both emitting APID
`0x09AA`, both with sequence counters starting at 0, both with null
`spacecraft.id`, land in the same `STATS ... BY` bucket, and **UACE-7 fires as a
replay alert because there are two vehicles, not because anything was replayed.**

The fix is an ingest enrichment: `source.ip` → `spacecraft.id`. Not optional, and
needed anyway because CSNE-1 keys on `source.ip`.

### The telemetry asymmetry

`ccsds_telemetry` has **no logs-lane home**. Spacecraft telemetry in this schema
is a *metrics* lane (`metrics-space.telemetry.otel-*`, OTLP from the COSMOS OTel
plugin), not a partition. Either send it as OTLP metrics or create a new logs
partition. Both demo detections are command-side, so this can wait.

---

## 7. Hop 7 — detection

Tested against the pisat's real command dictionary.

**Fire on the Zeek feed alone — nothing provisioned:**

| Rule | Keys on | What it catches |
|---|---|---|
| **UACE-7** Duplicate Command Packet Executions | apid, opcode, name, sequenceCount, source.ip | replay |
| **SMSR-6** Unauthorized Fault-Management Change | `command.name IN (HS_*/LC_*)` | watchdogs being disabled |

**One small lookup index away:** **CSNE-1**, unexpected ground-station IP —
`source.ip` joined against `ref-authorized-command-source`. This is the
rogue-commanding-source alert.

**Needs both feeds — the injection detector:** **UACE-8** counts, per APID,
records carrying `source.ip` (wire frames) versus those without (COSMOS records),
and alerts where wire frames exist but command-ops records do not. *A command was
transmitted that no operator ever issued.*

**Will not fire as written:** UACE-6 (needs `groundStation`, absent on wire
frames — **despite its name it is not the rogue-source rule for this feed**);
UACE-1 and UACE-2 (NOS3 `GENERIC_*` literals, confirmed absent); UACE-3 (needs its
target list swapped to the pisat's — a one-line change); UACE-12 (needs
`logs.ecs.spacecraft.events`); CSNE-4 / UACE-4 / UACE-9 (ML jobs, need training
data).

Four reference indices are needed across the full set:
`ref-authorized-command-source`, `ref-authorized-ground-station`,
`ref-command-schedule`, `ref-critical-registers`.

---

## 8. Hop 8 — the loop closes

The alert is not the end. A command goes back up on **UDP 5012**, and the
satellite moves — wings feather, LEDs change. A detection that *does* something,
in front of the audience.

Which means the response path is the same path an attacker uses. Commands arrive
from the network including malformed and hostile ones, so limits are clamped in
the flight agent: **±45°, glide, release after every move.**

---

## 9. Where each fact came from

| Claim | Source | Status |
|---|---|---|
| APIDs, packet and field layouts | `reference/cosmos-targets/` | authoritative |
| EPS 95-byte layout | `fixtures/eps_hk_tlm.hex` | **byte-verified** — `ccsds.py` rebuilds it exactly |
| Ports 5013 / 5012 | four independent sources | confirmed |
| Non-standard telemetry length | fixture + mail sample | observed, reproduced |
| Zeek field lists | mail samples | live — **not** the repo, which is stale |
| Payload flags are booleans | Aerospace lead, 4 Aug | confirmed |
| Partition shape, ECS mapping | `space_cyber_security` schema | authoritative |
| Which rules fire | rule files + pisat dictionary | tested |
| `_bulk` vs `stream_bulk` | schema ingest doc | **unresolved — test it** |
| Command-body layout | — | `cfdp_download_cmd.hex` is truncated: 27 of 136 bytes |
