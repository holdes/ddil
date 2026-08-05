# Handoff — space-cyber demo, software side

**Written 5 Aug 2026, on the design machine, for whoever picks this up on the
DDIL kit.** Everything below is what was established by hand, on hardware, over
about two weeks. Several of these facts cost a day each to learn and are not
recoverable from the code.

The CAD is finished and stays on the design machine. From here it is software
and integration only.

---

## 1. What the demo is

A 1U CubeSat prop sits on a pedestal at the Elastic × Aerospace booth at DEF CON.
It streams real CCSDS Space Packets over WiFi to a ground station running OpenC3
COSMOS and a Zeek CCSDS analyzer. Zeek decodes the packets on the wire and ships
them to Elastic. When Elastic raises a SPARTA detection, a command goes back up
and **the satellite visibly moves** — two wings feather, twelve LEDs change.

The point of the story is that nothing is installed on the satellite to catch the
attack. Detection happens off the wire, against a vehicle you do not control and
cannot instrument.

**Booth setup: Thursday 11:00.** Entry is escorted by the Aerospace team; contact
details are held outside this repo.

---

## 2. The people

| Role | Org | Owns |
|---|---|---|
| **Flight-software lead** | Aerospace | The pisat, its cFS flight software, the ground station, the Zeek CCSDS analyzer |
| **Detection engineer** | Elastic | The Elastic side — SPARTA schema, detections, the Filebeat/Logstash shipper |
| **Programme contact** | Aerospace | cc'd throughout |
| **Integration** | Elastic | The kit, the prop, end-to-end integration |

Names and contact details are deliberately not in this repo — it is public. Ask
the integration owner.

The live plan is in the **"PiSat logs"** mail thread. Read it before starting —
it is short, and it is ahead of every repo.

---

## 3. Three repos, and how they relate

| Repo | What |
|---|---|
| `the-aerospace-corporation/spacecop-demo` | **Upstream.** NASA cFS flight software for the pisat, built on Alan Johnston's CubeSatSim. Custom apps `eps` `sysmon` `stpyld` `camera` `spacecop`, plus `gsw/` (Zeek + COSMOS) and `spacecop_ml/` (Rust). Deliberately public — Aerospace is inviting people to find flaws in it as part of the challenge. |
| `rtinney1/pisat-gsw` | **A byte-identical copy of `spacecop-demo/gsw/`.** `diff -rq` across all 180 files is clean; it adds only a `.gitignore`. Track spacecop-demo; ignore this one. |
| `Villegas12/space_cyber_security` | The Elastic SPARTA detection schema. 203 detections, 104 rules, grounded in NOS3 `cmd_tlm_db` and the SPARTA v3.2 STIX bundle. |

### The gap

`space_cyber_security` has **zero** references to spacecop, pisat, CubeSatSim, or
the `ccsds_commands` / `ccsds_telemetry` Zeek streams — 0 matches across the
whole tree, all file types. Its Zeek usage is the stock Elastic integration for
the ground IT segment, not the CCSDS analyzer.

The two halves were built independently. Closing the gap is the integration work.

### ⚠️ The Aerospace repo is STALE

The Aerospace lead confirmed on 4 Aug that the analyzer changes have not been
pushed — there has been no time to maintain the repo alongside everything else.
The **live** Zeek analyzer decodes **parameters**, not just headers. The repo
version does headers only. Real output carries flattened `parameters.*` keys —
`parameters.CCSDS_FC`, `parameters.DESTINATION`, and for telemetry the full EPS
housekeeping set (`BatteryV`, `RSolarPanelP`, `CommandCount`, …).

**Do not derive field lists from the repo.** Use the samples in the email thread.

---

## 4. Facts that cost real time

### Ports: telemetry 5013, commands 5012

Confirmed four independent ways: `pisat_sim.py`, the Zeek analyzer header, live
captures in the email thread (`dst_port 5012` on a command), and the COSMOS
plugin's UDP interface line `udp_interface.rb <ip> 5012 5013` — write-destination
5012, read 5013.

The operational-picture SVG had these **backwards** (TM 5012 / TC 5013). Corrected
in `webapp/build.py`; the source SVG in `comms/` was left alone.

### The message IDs

Telemetry `0x09xx`, command `0x19xx`:

| App | CMD | REQ_HK | HK_TLM |
|---|---|---|---|
| eps | `0x19AA` | `0x19AB` | `0x09AA` |
| sysmon | `0x19CA` | `0x19CB` | `0x09CA` |
| stpyld | `0x19BA` | `0x19BB` | `0x09BA` |
| camera | `0x19DA` | `0x19DB` | `0x09DA` |

SpaceCop: HB `0x19FC`, CMD `0x18FE`, REQ_HK `0x18FF`, CTI_SHARE `0x09FC`,
REPORT_TLM `0x08FD`, HK_TLM `0x08FE`, DEVICE_TLM `0x08FF`.

### CCSDS packet layout — the endianness boundary

| Offset | Size | Field | Endian |
|---|---|---|---|
| 0 | 2 | `CCSDS_STREAMID` | BIG |
| 2 | 2 | `CCSDS_SEQUENCE` | BIG |
| 4 | 2 | `CCSDS_LENGTH` | BIG |
| 6 | 4 | `CCSDS_SECONDS` | BIG |
| 10 | 2 | `CCSDS_SUBSECS` | BIG |
| 12 | 4 | `CCSDS_SPARE` | **LITTLE** |
| 16 | … | body | **LITTLE** |

The switch at offset 12 is the classic way to decode garbage that still looks
plausible. Byte-verified fixtures are in `flight/fixtures/`.

### ⚠️ GPIO2 and GPIO3 are dead on the original Pi Zero

They no longer work open-drain. They still read high, drive as outputs, and
measure 3.27 V on a meter — which is why four scans, two scripts and a full
software audit all missed it. Nothing ever acknowledges.

I²C runs on a **software bus**:

```
dtoverlay=i2c-gpio,i2c_gpio_sda=23,i2c_gpio_scl=24,bus=3
```

in `/boot/firmware/config.txt` — that is **pins 16 and 18**, and `i2cdetect` must
be given **`-y 3`**.

**If a card is ever reflashed that line must go back**, or nothing on I²C answers
and it presents as a brand-new fault. `rebuild-pi.sh` has it.

Cause: two 5 V events — the SparkFun Qwiic pHAT, then the PiSugar's pogo pins.
**Tape the pogo pins whenever the stack is open.** A replacement Pi Zero with
headers has been ordered; on that one pins 3/5 work and hardware I²C is fine.
Leave the overlay line in anyway so both Pis behave identically.

### The servo envelope — this is a hard constraint on the flight agent

* **±45°** sweeps freely, no mechanical fouling. A 37-move stepped sweep held
  `throttled=0x0`.
* **Glide, never jump.** Eased motion never asks a motor for full speed from
  rest — which is why both wings can move together on one cell, against the
  original one-at-a-time rule.
* **Release after every move.** A held servo buzzes and draws continuously.
* The ±60° reboot came from *holding* position back to back. Duty cycle matters
  more than angle.

Commands arrive over the network, including malformed ones, so the limit must be
clamped in code.

### Hardware status

| | |
|---|---|
| Frame, decks, brackets, wings, panels, pedestal | printed, fitted, done |
| Both servos via PCA9685 at `0x40` | proven, together, gliding |
| SK9822 strip, 12 LEDs | proven |
| BME280 | **dead** — powered, LED on, no ACK at `0x76`/`0x77`. Replacement is a keyed Qwiic plug swap onto the proven chain |
| Camera (Arducam UC-261) | CSI ribbon latch broke mechanically. May come back with the new Pi Zero |
| Modulino IMU | untested — would confirm SDA/SCL through the soldered chain |

---

## 5. Two vehicles — the decision, and why

There will be **two physical satellites** on the same WiFi: the Aerospace pisat and our
prop. A CCSDS packet has no spacecraft field — the APID identifies the
*application*, not the vehicle. Only the source IP separates them.

**Decision: our prop emits the pisat's APIDs.** The Aerospace Zeek analyzer
decodes it unchanged and it appears in COSMOS as ordinary `EPS_HK_TLM`. Identity comes
from `source.ip` downstream. Zero cost to Aerospace, which is the scarcest
resource this week.

### ⚠️ The false positive this creates if identity is not enriched

UACE-7 (replay detection) groups by:

```
BY spacecraft.id, primaryHeader.apid, command.opcode, command.name,
   primaryHeader.sequenceCount
| WHERE occurrences > 1
```

In the schema `spacecraft.id` derives from `cosmos.scope`, and **wire-captured
frames have no `cosmos.scope`** — that absence is deliberately the injection
signal. So `spacecraft.id` is null for Zeek-sourced traffic.

Two vehicles, both APID `0x09AA`, both sequence counters starting at 0, both with
null `spacecraft.id`, land in **the same bucket**. The replay alarm fires because
there are two spacecraft, not because anything was replayed — on the show floor,
with no attacker.

**So the `source.ip` → `spacecraft.id` enrichment is not optional.** It is what
stops the headline detection crying wolf. It is also needed anyway: CSNE-1, the
rogue-commanding-source rule, already keys on `source.ip`.

### Naming

Ours gets a dedicated identity; **Aerospace's stays default and untouched**:

| | Aerospace's | Ours |
|---|---|---|
| COSMOS targets | `EPS`, `CAMERA`, … | `DEMOSAT_EPS`, `DEMOSAT_CAMERA`, … |
| COSMOS interface | `PISAT_INT` | `DEMOSAT_INT` |
| `spacecraft.id` | pisat | `DEMOSAT-1U` |

COSMOS handles multiple vehicles by **installing the plugin twice** with different
variables. `gsw/openc3-cosmos-cfs/plugin.txt` already has a `VARIABLE` for every
target name and for `target_ip`. **One blocker:** `INTERFACE PISAT_INT` is
hardcoded and interface names must be unique per scope — so we need our own copy
of `plugin.txt` with that made a variable. Our copy, not theirs.

(COSMOS *scopes* are the proper tenancy boundary and what `cosmos.scope` refers
to, but both vehicles in `DEFAULT` share one scope and it separates nothing.
Multi-scope may be an Enterprise feature — confirm before building on it.)

---

## 6. The Elastic integration

### Where the data goes

Four lanes, per the Elastic-side shipper: Zeek commands, Zeek telemetry, `conn.log`, and
the pisat portal auth log. API key needs create on `logs.ecs`,
`logs-zeek.connection-default`, `logs-pisat-portal`.

Target partition is **`logs.ecs.spacecraft.commands`**, which the schema
explicitly designed for *two* feeds: the COSMOS command-ops record, and *"the
wire frame captured at the Command Ingest boundary … including frames with no
command-ops record."* The Zeek feed is the second one. The slot was cut for it
and never wired up.

### ⚠️ OPEN RISK — verify this first

The Elastic-side Logstash output block:

```
index => "logs.ecs"     # our wired stream
action => "create"
data_stream => false
```

The schema's own ingest doc says:

> Use `stream_bulk` … **not** the regular Elasticsearch `_bulk` API. `es_bulk`
> bypasses the wired-stream layer and writes directly to the backing data stream
> — documents are not partition-routed and do not run the processing chain.

Logstash's elasticsearch output writes through `_bulk`. If that bypasses the
wired-stream layer, data lands looking **perfectly healthy in Discover** while
skipping partition routing and the ECS overlay entirely — and no detection ever
fires. This config is already in Aerospace's hands.

**`flight/check_stream_route.sh` settles it in two minutes:**

```bash
ES_URL=https://<es-node>:9200 ES_AUTH='elastic:...' ./check_stream_route.sh
```

It writes one tagged document exactly the way Logstash does and counts it in the
parent versus the partition. Three outcomes, each with the fix printed.

### Version

The schema is validated against **9.4.2** and states 9.4+ or Serverless. **The
kit is on 9.3.1.** The ES|QL rules query an index name, so they do not inherently
need wired Streams — what 9.3.1 costs is Streams Processing for the ECS overlay,
replaceable with a classic ingest pipeline. The sharper question is whether
`LOOKUP JOIN` works on 9.3.1; four reference indices need it
(`ref-authorized-command-source`, `ref-authorized-ground-station`,
`ref-command-schedule`, `ref-critical-registers`).

### Which detections actually fire — tested against the pisat dictionary

**Fire on the Zeek feed alone, no join, no second feed, nothing provisioned:**

| Rule | Keys on |
|---|---|
| **UACE-7** Duplicate Command Packet Executions | apid, opcode, command name, sequenceCount, source.ip |
| **SMSR-6** Unauthorized Fault-Management Change | `command.name IN (...)` |

**SMSR-6 works unmodified** — all six of its literals (`HS_DISABLE_APPMON`,
`HS_DISABLE_EVENTMON`, `HS_DISABLE_CPUHOG`, `HS_DISABLE_ALIVENESS`,
`LC_SET_AP_PERMOFF`, `LC_SET_LC_STATE`) exist in the pisat's 1,025-name
dictionary. They are standard cFS Health & Safety and Limit Checker commands and
the pisat carries both apps. The rule was written for NOS3 and happens to fit.

**Fires with one small lookup index:** **CSNE-1** (rogue source, `source.ip`).

**Needs both feeds — the injection detector:** **UACE-8** counts, per APID, records
with `source.ip` (wire frames) versus without (COSMOS records), and alerts where
wire frames exist but command-ops records do not.

**Will not fire as written:**

* **UACE-6** — needs `groundStation`, absent on wire frames. *(Note: this is
  named "Unauthorized Commands Issued from Unrecognized Ground Station" and looks
  like the rogue-source rule. It is not, for this feed. CSNE-1 is.)*
* **UACE-1**, **UACE-2** — NOS3 `GENERIC_*` literals; confirmed absent from the
  pisat dictionary
* **UACE-3** — `target_name IN ("GENERIC_ADCS","GENERIC_EPS","GENERIC_RADIO")`.
  The pisat's targets are `CAMERA CFDP CFE CFS CS DS EPS FM HK HS LC MD MM SC SCH
  SPACECOP STPYLD SYSMON`. **A one-line swap fixes it** — and with `parameters.*`
  now decoded, more of this class is reachable than first assessed
* **UACE-12** — also needs `logs.ecs.spacecraft.events`
* **CSNE-4, UACE-4, UACE-9** — ML jobs, need training data

---

## 7. Networking

The kit brings its own UniFi Express 7. At the venue there is no home network, and
every Pi is headless — **once a device is off the network there is no way back
in.** macOS cannot mount the Pi's ext4 root to fix a profile offline; recovery is
HDMI + keyboard or a serial cable.

**Bootstrap trick:** stand up a temporary WLAN on the UniFi using the *old* home
SSID and passphrase. Every Pi already holds that profile and joins on its own.
SSH in over it, stage the real network, then disable the temporary WLAN.

`netstage.sh` does the staging — adds the profile at a higher autoconnect
priority and **does not activate it**, because NetworkManager will not roam off a
working association and activating mid-run would cut the SSH session it runs over.

```bash
export STAGE_PSK='...'
./netstage.sh --ssid ddil-ops pi@groundation.local pi@pisat.local
./netstage.sh --list pi@groundation.local
```

Do the whole cycle **at home**, including disabling the temporary WLAN, so a bad
profile is a two-minute fix rather than a dead device at the venue. Addresses
change afterwards — find devices by mDNS (`pi@<host>.local`) or the UniFi client
list.

Do not leave the bootstrap WLAN broadcasting at DEF CON — anything joining it is
on the kit's network. Isolate it on its own VLAN or turn it off.

Give every headless device an out-of-band path: USB gadget mode on the Pi Zero
(`dtoverlay=dwc2`, `modules-load=dwc2,g_ether`) gives SSH over the USB cable with
no network at all. JetKVM covers the rack. A USB-TTL serial cable covers the rest.

Credentials are not in this repo, and must not be added to it.

---

## 8. What is in this tree

```
flight/
  check_stream_route.sh   the wired-stream write-path probe — RUN THIS FIRST
  pca9685.py              minimal servo-driver on smbus2 (bus 3, addr 0x40)
  demo.py                 all-systems demo; enforces the power rules in code
  wings.py bench.py ledtest.py wiggle.py conttest.py findpin.py
  fixtures/               byte-verified CCSDS packets from real captures
build-guide/
  10-connections.md       THE authoritative connection register, with
                          PROVEN / ASSUMED / FAILED status on every line
  06-software-and-link.md 08-pinout.md 09-hookup.md ...
diagrams/  satellite-topology.{mmd,svg}
webapp/    build.py — the mission console (reads the CAD renders; design machine only)
netstage.sh            WiFi pre-staging
rebuild-pi.sh          takes a fresh Pi OS install back to working state
pisat_sim.py           pulled from the groundstation; APIDs match spacecop-demo exactly
```

`cad/` is gitignored — finished, 64 MB, and nothing downstream needs it.

---

## 8b. The full data path

`DATAFLOW.md` documents every hop end to end: the 41 telemetry packets and 254
commands the vehicle can emit, the UDP link, both ground-station consumers
(COSMOS and the Zeek tap), the four shipper lanes, the field-by-field ECS
mapping, and which detections fire on which feed. Read it before touching
anything in the middle of that chain.

---

## 9. What to do next, in order

1. **Run `flight/check_stream_route.sh`** against the kit. Everything else on the
   Elastic side is guesswork until this is answered.
2. **Get `pisat-shipper.zip` from the Elastic side.** It is already built — the Filebeat +
   Logstash config — do not rebuild it. We need to be working against the
   same pipeline.
3. **Build the `source.ip` → `spacecraft.id` enrichment.** Not optional; see §5.
4. **Write the flight agent** for the prop. Unblocked — framing, MIDs, layouts and
   fixtures are all local. Emit the pisat's APIDs; accept commands on 5012 so the
   same rogue-commanding traffic that trips the detection also moves the hardware;
   clamp to ±45°; glide and release. Probe the camera at startup rather than
   hard-coding `CameraAvailable`, since the new Pi may bring CSI back.
5. **Our `plugin.txt` copy** with a variable interface name → `DEMOSAT_*`.
6. **Prove UACE-7 fires** end to end. It needs nothing provisioned, so it is the
   cheapest possible proof the whole chain works.
7. Then CSNE-1 with its lookup index — which also answers whether `LOOKUP JOIN`
   works on 9.3.1, and therefore whether the 9.4 upgrade is required or merely
   tidier.

---

## 10. Things that will bite

* **The repo is stale.** Field lists must come from the email samples, not
  `ccsds_full_analyzer.zeek`.
* **`_bulk` vs `stream_bulk` fails silently.** Healthy-looking data, no
  detections. §6.
* **Reflashing loses the i2c-gpio overlay.** Presents as a brand-new hardware
  fault. §4.
* **Two vehicles on one APID with null `spacecraft.id`** trip UACE-7 as a false
  positive. §5.
* **UACE-6 is not the rogue-source rule** for this feed, despite its name. CSNE-1
  is.
* **Never let 3.3 V and 5 V meet.** That is what killed the pHAT, the BME280, and
  the Pi's I²C pins. Tape the PiSugar pogo pins whenever the stack is open.
* **A held servo draws continuously.** Release after every move.
