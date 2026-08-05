# Mini Satellite — Build Plan & Bill of Materials

A working 1U CubeSat prop that **feeds real telemetry** into the groundstation
(OpenC3 COSMOS on `groundation`), plus two showpiece behaviours that tie software
events to physical motion and light.

---

## 1. Design basis

**Structure: the *HC-Eleni* 1U model** — chosen over the NASA CubeSat and
HeliosCube because it ships a real **internal deck stack**, which is how actual
CubeSat avionics are built (PC/104-style stacked boards).

| Part | Extents | What it is |
|---|---|---|
| `obj_4_part 1.2.stl` | **100.01 × 100.01 × 100.00 mm** | outer shell, 2.1–2.4 % fill (thin-wall hollow); 99 perforations in the base, 39 in the top |
| `obj_1_part 2 floor 1.stl` | 88 × 88 × 12 mm | deck, 31 mounting holes, integrated standoffs |
| `obj_2_part 2 floor 2.stl` | 88 × 88 × 11.8 mm | deck, 80 mounting holes |
| `obj_3_part 2 floor 3.stl` | 88 × 88 × 4 mm | top deck, 19 holes |
| `obj_5_part 3.2.stl` | 100 × 100 × 11.9 mm | cap / adapter, 20 % fill |

Exactly **100 mm** — true 1U. Deck area **88 × 88 mm** each, and ~96 mm of
internal height to distribute three decks through. Shell + decks are light
(thin-walled), so budget filament for the wings and pedestal, not the body.

Alternatives measured and rejected:
- *NASA Cube Satellite* — 103 × 103 × 114 mm closed shell, 0.9 L cavity, but no
  internal structure; we would have designed the trays from scratch.
- *HeliosCube* — 100 mm skeletal frames at 1.8 % fill, modular and stackable to
  3U, but open-frame (less "flight hardware" looking) and also no decks.
- *WGS miniature* — great silhouette, but the bus is a **solid block** (96 % fill,
  only a 38 mm² rod socket) with no usable volume at all.

### Deck assignment — one subsystem per floor

Mirrors a real spacecraft stack, and puts the mass low:

| Deck | Subsystem | Contents | Why here |
|---|---|---|---|
| **Floor 1** (bottom, 12 mm) | **EPS** | 3×AA holder, CN3791 charger, 2× INA3221 | Heaviest parts lowest — keeps the centre of mass down on a pedestal. Needs ~20 mm clearance for the 17 mm battery holder. |
| **Floor 2** (middle, 11.8 mm) | **Avionics** | Pi Zero 2 W, PCA9685 | Its 80 perforations are ideal for routing the I²C/SPI/servo harness |
| **Floor 3** (top, 4 mm) | **Payload** | BME280, MPU6050, NEO-8M GPS, ArduCAM | Sensors want to be near the skin; GPS antenna as high as possible; camera aligns to a face aperture |

### What we can and cannot print

The decks invite printed mounting, so to be clear about the line:

**Printable** — sensor carriers that clip into the deck hole grid, the ArduCAM
aperture + lens hood, a GPS antenna cradle, solar-panel recess frames on the
wings, LED diffusers / light pipes, and the wing spar channels.

**Not printable** — the sensing elements themselves (BME280, IMU, INA3221, GPS,
camera, solar cells). Those are bought; we print everything that *holds* them.

**The BOM is derived from the telemetry contract**, not invented. Every sensor
below exists to fill a field the `openc3-cosmos-cfs` plugin already decodes, so
the existing COSMOS screens and the aero kiosk light up with **zero software
changes**:

| Packet | APID | Fields we must produce |
|---|---|---|
| `EPS_HK_TLM` | 0x09AA | 8× panel V + mA, battery V/mA, Present flags, SensorCount |
| `STPYLD_HK_TLM` | 0x09BA | temp, pressure, altitude, humidity, gyro XYZ, accel XYZ, GPS ×3 |
| `SYSMON_HK_TLM` | 0x09CA | uptime, CPU temp/load, memory, disk — **no hardware needed** |
| `CAMERA_HK_TLM` | 0x09DA | image counter, capture status, path, size |
| `SPACECOP_REPORT_TLM` | 0x08FD | IDS alert strings |

**Panel count:** the EPS packet carries `RSolarPanelP` … `USolarPanelP`
*Present* flags plus `SensorCount`, so partial population is designed in. We use
**4 panels (2 per wing)** mapped to `L*`/`R*`, with body faces `Present = 0`.
That halves the sensor count and wiring versus 8.

---

## 2b. Phasing — why solar is deferred

**Phase 1 (build now):** wings carry **mimicked** solar panels. No cells, no
current monitors, no battery, no charger, and — critically — **no electrical
joint crossing the wing hinge**.

Rationale, in order of weight:

1. **Real panels indoors would look broken.** Indoor light delivers 1–5 % of
   outdoor output, so genuine panels report ~1–3 mA. Every face would sit at
   `YELLOW_LOW` on the kiosk permanently. Simulated orbital values read as
   *correct* and are honest to the framing — we are simulating a spacecraft in
   orbit, not claiming to be in one.
2. **It deletes the two hardest assembly tasks:** soldering fragile cells, and
   routing wires through a moving hinge.
3. **Mass drops sharply** — no battery pack. Easier on the servos, less stress at
   the wing root, more stable on a pedestal.
4. Saves ~$53 and a large share of the wiring.

**The audience interaction still works — better.** The planned moment was
"shine a light on a wing." Replace it with:

| Action | Telemetry that visibly moves | Sensor |
|---|---|---|
| Pick up / tilt the satellite | `GyroX/Y/Z`, `AccelX/Y/Z` | MPU6050 |
| Cup it in your hands / breathe on it | `Temperature`, `Humidity` | BME280 |
| Command wing deployment from COSMOS | physical motion | MG90S |

People instinctively touch and tilt things; nobody instinctively shines a torch.
And this works regardless of hall lighting.

### Real vs simulated telemetry in Phase 1

| Subsystem | Phase 1 | Notes |
|---|---|---|
| `STPYLD` | **real** | BME280 + IMU — the interactive one |
| `SYSMON` | **real** | host CPU/mem/disk/uptime |
| `CAMERA` | **real** | actual captured images |
| `SPACECOP` | **real events** | IDS alerts drive the LEDs |
| `EPS` | simulated | orbit model already written in `pisat_sim.py` |
| GPS | simulated | would not lock indoors regardless |

Three of five subsystems genuinely real, and the two simulated ones are the two
that *cannot* be real indoors anyway.

### Design for the upgrade

Phase 1 CAD must not preclude Phase 2:
- Wing panels get a **recess dimensioned for real 60 × 36 mm panels**, so cells
  drop straight in later
- The hinge gets a **cable channel and JST pocket** even though unused now
- Floor 1 keeps its **battery/EPS footprint reserved** — do not fill it with
  something else

### Mimicking the panels convincingly

- Print wings in **dark blue or black PETG** with the cell grid modelled as
  shallow scored channels (~0.4 mm deep, one per 20 mm cell)
- If the printer has multi-material, print the **cell grid and busbar lines** as
  a second colour — by far the most convincing option
- Otherwise: dark blue metallic **vinyl** cut to the recess, or an adhesive
  solar-cell texture decal. Convincing from 60 cm, which is all that matters.
- Model the **diagonal busbars** real cells have; that detail is what reads as
  "solar" more than colour does

---

## 2. Bill of materials

Prices are rough USD for planning only.

### Compute & control
| # | Item | Qty | ~$ | Why |
|---|---|---|---|---|
| 1 | **Raspberry Pi Zero 2 W** | 1 | 15 | aarch64 (same arch cFS already builds for); 65 × 30 mm |
| 2 | microSD **A2** 32 GB | 1 | 10 | A2 matters — we already killed one counterfeit card |
| 3 | **PCA9685** 16-ch I²C PWM driver | 1 | 6 | drives the wing servos; avoids doing servo timing on the Pi |
| 4 | TCA9548A I²C mux | 1 | 5 | only if addresses collide — buy as insurance |

### EPS — PHASE 2 (deferred, see §2b)
Solar hardware is **deliberately not in Phase 1**. Wings carry *mimicked* panels;
EPS telemetry is simulated from the existing orbit model.

| # | Item | Qty | ~$ | Why |
|---|---|---|---|---|
| 5 | **INA3221** 3-ch V+I monitor (I²C) | 2 | 16 | *Phase 2.* 6 channels: 4 panels + battery + spare |
| 6 | Encapsulated solar panel, 60×36 mm, 5–6 V | 4 | 16 | *Phase 2.* **Encapsulated with leads — NEVER bare cells;** bare silicon cracks while soldering and is the #1 reason these builds fail |
| 7 | **3× AA NiMH** holder + cells | 1 | 12 | *Phase 2.* Plugin limits are tuned for `3S AA NiMH` (3.2/3.4/4.3/4.5 V) |
| 8 | CN3791 MPPT charger | 1 | 6 | *Phase 2.* Makes `BatteryMa` swing charge ↔ discharge |
| 9 | Schottky diodes (1N5819) | 6 | 3 | *Phase 2.* Per-panel blocking |

### Payload sensors
| # | Item | Qty | ~$ | Fills |
|---|---|---|---|---|
| 10 | **BME280** (I²C) | 1 | 6 | `Temperature`, `Pressure`, `Altitude`, `Humidity` |
| 11 | **MPU6050** (or BNO055, ~$25, adds fusion) | 1 | 5 | `GyroX/Y/Z`, `AccelX/Y/Z` |
| 12 | u-blox **NEO-8M** GPS (UART) | 1 | 14 | `GPSVal1/2/3` — see caveat §5 |
| 13 | **ArduCAM OV5647 5MP, CS-mount** (CSI) | ✔ owned | — | `CAMERA_HK_TLM`. Measured: **PCB 36.0 × 36.0 mm, mount holes 28.80 × 28.80 mm at 3.00 mm ⌀, lens barrel 23 mm ⌀** |
| 13a | **Raspberry Pi Zero camera cable** (22-pin 0.5 mm → 15-pin) | 1 | 5 | ⚠️ **Required.** Every Pi Zero uses the narrow CSI connector; the Arducam ships with the standard 15-pin cable. Missing this stops build day dead. |

### ⭐ Wow factor 1 — commandable deployable wings
Send a real command from COSMOS → the wings physically deploy.

| # | Item | Qty | ~$ | Why |
|---|---|---|---|---|
| 14 | **MG90S** metal-gear micro servo | 2 | 10 | metal gear — plastic SG90 gears strip under repeated demo cycles |
| 15 | 3 mm carbon fibre rod, 300 mm | 2 | 8 | wing spars. Printed wings alone sag, then creep permanently — same cantilever problem as the rack shelf |
| 16 | JST-XH 2/4-pin connector kit | 1 | 10 | wings detach electrically **and** mechanically for transport |

### ⭐ Wow factor 2 — IDS alert lighting
SPACECOP fires → the satellite visibly flashes red through the shell.

| # | Item | Qty | ~$ | Why |
|---|---|---|---|---|
| 17 | **APA102 / DotStar** strip, 16–24 LEDs | 1 | 15 | **Deliberately not WS2812/NeoPixel** — WS2812 needs bit-banged timing on a Pi (PWM/DMA, conflicts with audio). APA102 is true SPI: clock + data, rock solid |
| 18 | 74AHCT125 level shifter | 1 | 3 | 3.3 V → 5 V logic safety margin |

### Power
| # | Item | Qty | ~$ | Why |
|---|---|---|---|---|
| 19 | **5 V 3 A** USB-C supply | 1 | 12 | budget: Pi 350 mA + 2 servos ~500 mA stall + LEDs ~1 A worst case ≈ **1.9 A peak** |
| 20 | 5 V BEC / buck for the servo rail | 1 | 6 | isolates servo inrush from the Pi — brownouts reboot the Pi mid-demo |
| 21 | Silicone wire 26–28 AWG + JST kit | — | 15 | |

### Structure & hardware
| # | Item | Qty | ~$ | Why |
|---|---|---|---|---|
| 22 | **PETG** filament | ~1 kg | 25 | **not PLA** — it sits under display lights, and we know what creep does |
| 23 | M3 heat-set inserts + M3×8 screws | 1 kit | 12 | printed threads strip after a few demo teardowns |
| 24 | M2.5 nylon standoffs | 1 kit | 6 | Pi + breakout mounting |
| 25 | Clear PETG (or 2 mm acrylic) | small | 8 | the window panel — lets the LEDs and guts show |

**Phase 1 total: ~$237.** Phase 2 (solar) adds ~$53 → ~$290 all-in.

Wing sizing (settled): **130 × 90 mm per wing, two 65 mm segments, ~360 mm total
span.** Not 200 mm — cantilever deflection scales with L⁴, so 130 mm is
**5.5× stiffer** than 200 mm, it stays proportionate to the 281 mm-wide rack, and
1–2 panel arrays are what a real 1U actually carries (200 mm reads as a 3U). With
mimicked panels there is no tip mass either, so **item 15's carbon spar is now
optional insurance rather than mandatory** — print one wing first and flex it
before deciding.

For visual presence, use **dihedral angle** rather than length: wings deployed at
a slight upward angle catch light far better than extra span.

---

## 3. Architecture

```
                    ┌─────────────── 1U CubeSat ───────────────┐
  solar wings ──────┤ 4 panels → INA3221 ×2 ──┐                │
  (servo-deployed)  │                          ├─ I²C ─┐       │
                    │ BME280, MPU6050 ─────────┘       │       │
                    │ PCA9685 → 2× MG90S servos ───────┤       │
                    │ APA102 LEDs ◄── SPI ─────────────┤       │
                    │ ArduCAM ◄────── SPI ─────────────┤       │
                    │ NEO-8M GPS ◄─── UART ────────────┤       │
                    │                          Pi Zero 2 W     │
                    │                     (flight agent, cFS)  │
                    └──────────────┬───────────────────────────┘
                                   │ WiFi — CCSDS packets
                                   ▼  UDP 5013 (telemetry) / 5012 (commands)
                          groundation → OpenC3 COSMOS → Zeek → Elastic
```

The flight agent reuses the exact CCSDS framing already proven in
`pisat_sim.py` (16-byte header, big-endian primary, little-endian body) —
we swap simulated values for sensor reads.

**Command path** is what makes wing deployment work: COSMOS sends a command to
5012, the agent actions it on the PCA9685. That closes the loop from mission
console to physical hardware.

---

## 4. Parts to design (CAD)

| Part | Purpose |
|---|---|
| `sensor_tray.stl` | Slots into the 96.5 mm cavity; mounting holes for Pi, INA3221s, PCA9685, BME280, IMU |
| `battery_tray.stl` | Retains the 3×AA holder low (keeps the centre of mass down) |
| `wing_root_hinge.stl` | Servo horn coupling + keyed detachable joint + JST pocket |
| `wing_panel.stl` | Segmented panel, **spar channel** for the 3 mm rod, recesses sized to the real solar panels |
| `window_panel.stl` | Replaces one face; clear PETG, LED diffusion |
| `led_spine.stl` | Routes the APA102 strip up an internal corner so light rakes across the interior |
| `camera_mount.stl` | ArduCAM at a body face with an aperture |
| `pedestal_base.stl` + `pedestal_post.stl` | Angled display stand, hollow post as cable conduit, branded face |
| `top_plate_mod.stl` | Existing top plate + cable/antenna pass-throughs |

---

## 5. Four things that will bite us — decide up front

1. **Indoor light will not power this.** Solar cells indoors give ~1–5 % of
   outdoor output. The cells and sensors are **real** — shine a phone torch on a
   wing and the kiosk reacts, which *is* the demo moment — but compute runs from
   the 5 V supply. Present it that way; don't imply self-powering.
2. **GPS will not lock indoors**, least of all in a convention centre. Either
   report `GPSValid = 0` honestly or inject a fixed position.
3. **Servo inrush browns out the Pi.** Hence item 20 — separate the servo rail.
   Skipping this means random reboots mid-demo.
4. **Plan the I²C address map before ordering.** 2× INA3221 + PCA9685 + BME280 +
   MPU6050 is fine, but sketch it; that's what item 4 is insurance for.

---

## 6. Build order

1. **Print the shell** (bottom / middle / top) in PETG, verify the cavity
2. **Bench the electronics flat on the desk** — full sensor read + CCSDS emit to
   COSMOS *before* anything goes inside a box. Debugging inside a 1U is misery.
3. Print + fit the **sensor tray**, mount the Pi and breakouts
4. **Wings**: print, fit spars, mount servos, verify deployment travel by hand
5. **LEDs** + window panel
6. **Pedestal**, cable routing
7. **Full integration** — the demo script end to end
8. **Transport rehearsal**: wings off, satellite off pedestal, into the case
