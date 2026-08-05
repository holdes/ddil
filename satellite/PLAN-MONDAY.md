# Plan — CubeSat ready to load, Monday night

**Now:** Fri 31 Jul 2026, evening. **Deadline:** Mon 3 Aug, 22:00. **~76 h wall clock.**

---

## Printing is NOT the critical path — corrected twice, 31 Jul

**Two real slicer figures, and they differ by 6x:**

| Part | Volume | Time | Rate |
|---|---|---|---|
| `camera_bracket` — tall, thin, **with supports** | 13.4 cm³ | 33 min | 24 cm³/h |
| `pedestal_base` — large, chunky, no supports | 345.4 cm³ | **2 h 27 m** | **141 cm³/h** |

**Estimating print time from volume alone does not work.** Geometry dominates:
layer count and travel moves cost time, extruded volume barely does. Treat any
cm³-based figure in this document as indicative only, and use the slicer.

Original plan assumed 12 cm³/h uniformly and concluded 57 h of printing at 84 %
utilisation with no slack. **Realistic total is closer to 11 h against ~70 h
available — about 16 % utilisation.**

**Consequences:**
- **Printing is no longer a project risk.** Nothing needs cutting. The pedestal
  cut-first logic is void and so is the "one failed print eats the margin" worry.
- `pedestal_base` finishes **tonight**, not Saturday. Queue `wing_panel` x2
  behind it overnight.
- The binding constraints are now **Saturday's four measurements** (which gate
  the last ~140 cm³ of CAD) and **assembly time**, not printer hours.

---

## Three tracks

### A — Printing (critical path, gated on printer hours)
### B — Measure & assemble (gated on Saturday's parts)
### C — Satellite telemetry script (gated on nothing)

**Downgraded 31 Jul after checking `06-software-and-link.md`.** This was written up
as "the largest unstarted item"; that was wrong and it was distorting the cut order.

The whole ground segment already exists and is proven on the Pi 5:

| | |
|---|---|
| `~/cosmos-project/` | COSMOS 7.2.1, Docker, UI :2900 |
| `~/openc3-cosmos-cfs/` | `pisat-gsw` plugin — **19 targets, 20 screens, SPACECOP IDS widget** |
| `~/cFS/build-native_std/` | NASA cFS, compiled, running natively |
| `~/pisat_sim.py` | **CCSDS simulator — reuse its framing, do not re-derive** |

**cFS stays on the ground station.** Nothing moves to the Pi Zero, so no build
toolchain or RAM headroom is needed on a 512 MB board.

So the satellite-side job is: read two I²C sensors, drop the values into framing
that already decodes against 19 COSMOS targets, emit on UDP 5012, listen on 5013.
**A script, not a system.**

Two real items it did surface:
- **COSMOS is currently stopped** (shut down to free RAM for the kiosk). The
  operator container wants ~4.7 GB for 19 targets. Confirm it restarts cleanly
  before Monday rather than during the demo.
- **socat bridge** (CI_LAB 1234 / TO_LAB 2234 → 5012/5013) still open. Marked
  non-essential; not a Monday problem.

---

## Friday evening (tonight)

**Print, in this order — small essentials first, so a failure on the big print
doesn't also cost you the parts you need to assemble:**

1. `deck_a` — 22.3 cm³, ~1.9 h
2. `camera_bracket` — 13.4 cm³, ~1.1 h
3. `wing_root_hub` ×2 — 16.2 cm³, ~1.3 h

≈ 4.3 h. Then start the long one overnight:

4. **`pedestal_base`** — 345 cm³, ~29 h → runs Fri night through Sat evening
   *(only if the pedestal is must-have — see decision above)*
   *Alternative if cut:* `wing_panel` ×2 (89 cm³, ~7.5 h)

**Also tonight:** the SK9822 strip, PCA9685 and level shifter already arrived.
Nothing blocks bench-testing the LED strip on any Pi you have — including whether
it runs on 3.3 V logic without the shifter.

---

## Saturday — measurement day

Arriving: **both UPS boards, hammer header, calipers, Qwiic pHAT, BME280, IMU.**

**One measurement pass, in this order.** Everything downstream keys off it:

| # | Measure | Unblocks |
|---|---|---|
| 1 | Fit hammer header, measure **Pi + pHAT + UPS stack height** | Deck B height → `LENS_Z` → `panel_camera` |
| 2 | **UPS board thickness with cell**, and which board wins | the 26 mm Pi bay |
| 3 | **MG90S nose + horn** | `servo_bracket`, `deck_b`, wing bore |
| 4 | **CS lens barrel length** | lens protrusion through `panel_camera` |
| 5 | **Magnetic connector OD + depth** (when it lands) | `dock_adapter`, post mount plate |

Send those five numbers and the whole 167 cm³ blocked queue opens in one pass.

**Print Saturday:** finish `pedestal_base`, then the 4 panels (69 cm³, ~6 h).

**Start Track C Saturday.** The flight agent can be written against simulated
sensor values before any hardware is mounted.

---

## Sunday — assembly

Arriving: **CanaKit Pi Zero kit, microSD, transport case.**

- Flash the card, bring the Pi up, get the Qwiic bus reading BME280 + IMU
- Populate `deck_a` **off the frame** (that's why nothing needs inserts)
- Slide panels in, seat the cap, 4 × M3 at ±47
- Print `deck_b`, `servo_bracket` ×2, `dock_adapter`, `pedestal_post`
- Track C: telemetry reaching the ground station over WiFi

---

## Monday — integration and pack

- Wings on, servo feathering commanded end to end
- Full demo rehearsal: telemetry → Zeek → Elastic → detection fires
- Pack the case
- **Hard stop 22:00**

---

## Cut list, in the order I'd cut

1. **Pedestal** (36 h) — a display stand. The demo works on a table.
2. **Wings + servos** (~12 h + assembly) — "wow factor 1", but the detection
   story stands without moving parts.
3. **Camera** (~2 h + CSI wiring) — the telemetry narrative doesn't need it.

**Never cut:** the cube, the Pi, the sensor bus, and the telemetry script. That is
the demo. Everything else is staging.

---

## Standing position, 31 Jul evening

**Verified by physical test, not just by CAD:**
- Frame, cap and all three OEM decks printed
- `panel_blank` fits the slots — thickness locked at **1.8 mm**
- `deck_gauge` drops into the corner reliefs — the 88 × 88 / ±41 interface is proven
- ⌀3.00 post bores thread M3, confirmed on the printed part

**Verified by measurement against the vendor meshes:**
- Every panel, both decks, the standoff chain, both deck layouts (0 collisions)

**Already working, untouched by this week:** the entire ground segment — CCSDS
framing, COSMOS with 19 targets, Zeek, Elastic detection.

The hard, uncertain parts of this project are the ones already finished.

---

## Standing risks

- ~~59 h of print in 76 h~~ — **corrected: 28 h at the measured rate. Not a risk.**
- **Flight agent unwritten.** Largest unknown; it is what makes this a demo
  rather than a model.
- **2.4 GHz at DEF CON** — untethered means WiFi is the only link, no wired
  fallback. Not a Monday problem, but it is a problem.
- **`deck_b` hole positions** are placeholders until `servo_bracket` exists.
