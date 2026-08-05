# 06 — Software & link

Gets telemetry off the satellite and into the existing stack.

The ground segment is **already built and working**. What does not exist yet is
the flight agent on the satellite itself — the piece that reads the sensors and
emits CCSDS. This section specifies it.

---

## What already exists

On the groundstation Pi (`groundation`, 10.0.0.75):

| Path | What |
|---|---|
| `~/cosmos-project/` | OpenC3 COSMOS 7.2.1 (Docker). UI on :2900, **localhost-bound** — reach it over an SSH tunnel |
| `~/openc3-cosmos-cfs/` | the `pisat-gsw` plugin, built and loaded — 19 targets, 20 screens, SPACECOP IDS widget |
| `~/cFS/build-native_std/exe/cpu1/` | NASA cFS, compiled and running natively on aarch64 |
| `~/pisat_sim.py` | CCSDS simulator — **this is the packet framing the flight agent must reuse** |
| `~/kiosk-aero/` | the Aerospace kiosk, running as a user service |

```
ssh -i ~/.ssh/groundation_ed25519 pi@10.0.0.75
```

**Known state:** COSMOS was stopped to free RAM for the kiosk. Restart with:

```
cd ~/cosmos-project && docker compose start
```

⚠ The operator container wants ~4.7 GB for 19 targets, so COSMOS + Chromium is
tight on 8 GB. Check free memory before a demo, not during one.

---

## The link

| Property | Value |
|---|---|
| Transport | UDP, **unicast** |
| Telemetry (satellite → ground) | port **5013** |
| Commands (ground → satellite) | port **5012** |

> ⚠️ **CORRECTED 4 Aug — these were the wrong way round in this file.**
> Three independent sources agree on the above: `pisat_sim.py` defaults to
> `--port 5013` for telemetry and works today; the Zeek analyzer's header states
> `5012: Commands / 5013: Telemetry`; and `bom/BOM.md` says the same.
>
> Written to the old (wrong) values, the flight agent would emit telemetry to
> the command port and listen on the telemetry port. Nothing would decode and
> nothing would error - the ground station would simply stay silent.
| Format | CCSDS Space Packets |

**Unicast is the fact the whole network design rests on.** Because it is unicast
and not multicast, the satellite and groundstation can sit on separate routed
subnets. But **NAT would rewrite `src_ip` and break command attribution** in the
Zeek/Elastic pipeline — which is the entire security story. Route, do not NAT.

### Packet framing

From `pisat_sim.py`. Get this exactly right or COSMOS will not decode:

| Section | Endianness |
|---|---|
| 6-byte primary header | **BIG_ENDIAN** |
| Secondary header | **BIG_ENDIAN** |
| Payload body | **LITTLE_ENDIAN** |

The mixed endianness is not a mistake — it is CCSDS. The primary header is
big-endian by standard; the bodies are little-endian because that is what the
flight software emits natively.

☐ Read `~/pisat_sim.py` and reuse its framing directly. Do not re-derive it.

---

## The flight agent — not yet written

A Python process on the Pi Zero that:

1. Reads BME280 (temp / pressure / humidity) and LSM6DSOX (gyro / accel) over I²C
2. Frames them as CCSDS Space Packets using `pisat_sim.py`'s framing
3. Emits to the groundstation on **UDP 5013** at a fixed cadence (1 Hz is plenty)
4. Listens on **UDP 5012** for commands
5. Executes commands: **feather wings**, **flatten wings**, **set LED state**
   (wings rotate about their own axis - they do not deploy or stow)
6. Applies the servo travel limits established in §05

### Design notes

☐ **Sensor read failures must not kill the process.** A dropped I²C read should
emit the last-known value with a stale flag, not crash the agent mid-demo

☐ **Clamp servo commands** to the limits from §05 in the agent, not just in the
ground software. The whole point of the demo is that commands arrive over the
network — including malformed ones

☐ Run it under systemd with `Restart=always`

☐ Log to journald so failures are diagnosable after the fact

### Suggested telemetry points

Mirror what the COSMOS screens already expect. At minimum:

`Temperature`, `Pressure`, `Humidity` · `GyroX/Y/Z`, `AccelX/Y/Z` ·
`WingState` (feathered / moving / flat) · `LedState` · `PacketCount` ·
`Uptime`

---

## Still to do on the ground side

☐ **socat bridge** so cFS talks to COSMOS: CI_LAB 1234 / TO_LAB 2234 → 5012/5013.
This lights up the 12 stock cFS targets alongside the simulated ones. Not
required for the satellite to work, but it makes the ground display much richer

☐ **SPARTA SOC** (`Villegas12/space_cyber_security`) needs **ES 9.4+**; the kit
is on **9.3.1**. Resolve before relying on it in the demo

---

## The security story

This is why the build exists, so it is worth being able to narrate:

```
satellite ──CCSDS/UDP──> groundstation ──> Zeek CCSDS analyzer
                                              └──> Elastic ──> SPARTA detections
                                                                    │
                                        IDS alert ──> LED state ────┘
```

An anomalous command on the uplink is seen by Zeek, detected in Elastic against
SPARTA techniques, and **the satellite's own LEDs change colour**. The prop is
not a mock-up of the story — it is a participant in it.

☐ Wire the alert → LED path end to end and rehearse it. It is the moment the
demo lands, and it involves the most moving parts.

---

## Before moving on

- [ ] COSMOS running, UI reachable over the tunnel
- [ ] Flight agent emitting on 5013, decoded by COSMOS
- [ ] Commands on 5013 move the wings
- [ ] Zeek seeing the traffic
- [ ] Alert → LED path rehearsed at least once

---

Next: [07 — Checkout](07-checkout.md)
