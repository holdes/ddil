# Satellite / space-cyber demo — working instructions

**Read `HANDOFF.md` first.** It carries the context that is not recoverable from
the code: which repo is stale, which detections actually fire, why the ports are
what they are, and which mistakes have already been made. This file is only the
operating manual.

Scope on this machine is **software and integration**. The CAD is finished and
stays on the design machine (`cad/` is gitignored).

---

## Ground truth

Where facts disagree, this order wins:

1. **Hardware** — what a meter or `i2cdetect` actually says
2. `build-guide/10-connections.md` — the connection register, with
   PROVEN / ASSUMED / FAILED on every line
3. The **email samples** in the "PiSat logs" thread — the live Zeek output
4. `reference/cosmos-targets/` — **the authoritative wire layout** for every
   packet. Vendored here because the kit has no access to the upstream repos.
5. `the-aerospace-corporation/spacecop-demo` — the flight software, if reachable
6. `rtinney1/pisat-gsw` — a byte-identical copy of `spacecop-demo/gsw/`; adds
   nothing, do not treat as a separate source

**Do not derive Zeek field lists from the repo.** The parameter-decoding fix is
not pushed; the checked-in analyzer decodes headers only, the live one decodes
everything. Use the mail samples.

---

## Constants that are settled — do not re-derive

| | |
|---|---|
| Telemetry | UDP **5013** |
| Commands | UDP **5012** |
| Telemetry MIDs | `0x09xx` — EPS `0x09AA`, SYSMON `0x09CA`, STPYLD `0x09BA`, CAMERA `0x09DA` |
| Command MIDs | `0x19xx` — EPS `0x19AA`, SYSMON `0x19CA`, STPYLD `0x19BA`, CAMERA `0x19DA` |
| SpaceCop report | `0x08FD` |
| Header | 16 bytes; big-endian through offset 11, **little-endian from offset 12** |
| I²C | software bus 3 on pins 16/18 (`-y 3`) — pins 3/5 are dead on the original Pi |
| PCA9685 | `0x40`, plus All-Call `0x70` |
| Servo travel | **±45° hard limit**, glide, release after every move |

Our vehicle is `DEMOSAT-1U` / `DEMOSAT_*` targets. **Aerospace's stays default and
untouched** — never modify their repo or their plugin; add alongside.

---

## Running things

Flight code is plain Python 3 on the Pi with `smbus2` and `gpiozero`/`lgpio`.
`pigpio` is gone from Trixie — do not reach for it.

```bash
python3 flight/bench.py            # subsystem checks
python3 flight/demo.py             # all-systems demo
BRIGHT=20 python3 flight/demo.py   # LED brightness 1-31
python3 flight/wings.py sync       # both wings together
```

`flight/check_stream_route.sh` probes the Elasticsearch write path — run it before
trusting anything on the Elastic side.

`rebuild-pi.sh` takes a fresh Pi OS install back to working state. **After any
reflash, confirm the `dtoverlay=i2c-gpio` line is in `/boot/firmware/config.txt`**
or nothing on I²C answers and it looks like new hardware damage.

`netstage.sh` pre-loads a WiFi profile onto headless Pis from another machine;
`join-wifi.sh` does the same thing run on the device itself, which is simpler
when you already have an ssh session and no key distributed. Neither activates
the new network - that would cut the session doing the work.

`reference/` holds vendored copies of what the upstream repos provide, so this
machine works offline. Read `reference/README.md` first: the Zeek analyzer copy
there is stale and must not be used for field lists.

---

## Conventions

**Verify on hardware, then say so.** This project has repeatedly been bitten by
code that compiles, runs cleanly, and drives nothing — a sweep aimed at the wrong
GPIO, an LED end-frame from the wrong chip family, a check that agreed with its
own wrong assumption. If something has not been observed working, mark it
ASSUMED. Do not report a test as passing because it did not throw.

**Model the mating part in code, measured, rather than transcribing a datasheet.**
That is how the CAD side avoided a long tail of fit errors, and the same applies
to packet layouts: parse the fixture, do not retype the table.

**Commands arrive from the network, including malformed ones.** Clamp limits in
code, not in the caller.

**Do not put credentials in this repo.** WiFi and account passwords are held
elsewhere; ask rather than inventing a placeholder that ends up committed.

**Ask before pushing.** The parent repo is 13 commits ahead of its remote with a
large uncommitted working tree; nothing here has been authorised for push.

---

## Hardware hazards

* **3.3 V and 5 V must never meet.** That killed the Qwiic pHAT, a BME280, and the
  Pi's I²C pins.
* **The PiSugar's pogo pins are an exposed 5 V surface.** Tape them whenever the
  stack is open.
* **A held servo buzzes and draws continuously.** Release after every move; the
  reboot at ±60° came from holding position, not from the angle.
