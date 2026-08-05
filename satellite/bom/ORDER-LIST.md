# Satellite — Order List (Phase 1)

Buy-now list for the 1U CubeSat demo prop. Phase 1 = **no solar hardware**
(wings carry mimicked panels), **no GPS** (won't lock indoors, values simulated).
Both are additive later; nothing here precludes them.

Prices are planning estimates, not quotes.

> **⚠️ The single most important ordering rule:** buy sensors in the
> **Adafruit STEMMA QT** or **SparkFun Qwiic** flavour. Same polarity-proof 4-pin
> JST-SH connector, daisy-chainable, and it removes **all** sensor soldering.
> The cheaper-looking identical listing usually ships a bare board with a loose
> pin strip in the bag — that's where soldering appears from.

---

## A. Compute — order first, longest lead time

| ✓ | Item | Qty | ~$ | Notes |
|---|---|---|---|---|
| ☐ | **Raspberry Pi Zero 2 W** | 1 | 15 | 65 × 30 mm, aarch64 |
| ☐ | **microSD A2, 32 GB** (SanDisk/Samsung, reputable seller) | 2 | 20 | Buy **two** — one spare. We already lost a build to a counterfeit card |
| ☐ | **Raspberry Pi Zero camera cable** (22-pin 0.5 mm → 15-pin) | 1 | 5 | ⚠️ **Do not skip.** Every Pi Zero uses the narrow CSI connector; your Arducam ships with the standard 15-pin cable. Without this the camera physically cannot connect |
| ☐ | Pi Zero USB-C power supply, **5 V 3 A** | 1 | 12 | Budget: Pi 350 mA + servos ~500 mA + LEDs ~1 A ≈ 1.9 A peak |
| — | ~~Arducam OV5647 CS-mount~~ | ✔ | — | **already owned** (UC-261 Rev.D) |

## B. I²C bus & sensors — the no-solder path

| ✓ | Item | Qty | ~$ | Notes |
|---|---|---|---|---|
| ☐ | **Qwiic pHAT for Raspberry Pi** (SparkFun) *or* Adafruit STEMMA QT HAT | 1 | 7 | Sits on the Pi's GPIO, gives 4× JST-SH I²C ports. This is what removes the wiring |
| ☐ | **BME280** breakout, STEMMA QT / Qwiic | 1 | 15 | `Temperature`, `Pressure`, `Humidity`, `Altitude` — the breathe-on-it interaction |
| ☐ | **6-DoF IMU**, STEMMA QT — Adafruit **LSM6DSOX** (or MPU6050 Qwiic) | 1 | 12 | `GyroX/Y/Z`, `AccelX/Y/Z` — the pick-it-up-and-tilt-it interaction |
| ☐ | **JST-SH 4-pin cables**, assorted 50/100/200 mm | 1 kit | 10 | Daisy-chains everything; buy longer than you think |

## C. Wing deployment (wow factor 1)

| ✓ | Item | Qty | ~$ | Notes |
|---|---|---|---|---|
| ☐ | **MG90S metal-gear micro servo** | 2 | 10 | **Metal gear** — plastic SG90 gears strip, and people will ask you to deploy it twenty times |
| ☐ | **PCA9685** 16-ch servo driver (Adafruit rev has STEMMA QT) | 1 | 15 | *Recommended but optional* — the Pi's 2 hardware PWM channels can drive 2 servos via pigpio. The PCA9685 removes servo jitter and keeps everything on one I²C chain |
| ☐ | **5 V BEC / buck converter**, 2 A+ | 1 | 6 | ⚠️ **Do not skip.** Servo inrush browns out a Pi Zero → random reboots mid-demo. Separate rail |
| ☐ | 3 mm carbon fibre rod, 300 mm | 2 | 8 | *Optional insurance.* At 130 mm wings with no panel mass, print one and flex it before deciding |

## D. IDS alert lighting (wow factor 2)

| ✓ | Item | Qty | ~$ | Notes |
|---|---|---|---|---|
| ☐ | **APA102 / DotStar** strip, ~16–24 LEDs, **with connectors pre-attached** | 1 | 15 | **Not WS2812/NeoPixel** — WS2812 needs bit-banged timing on a Pi and fights the audio peripheral. APA102 is true SPI (clock + data) and just works. Pre-connectorised = the last soldering iron avoided |
| ☐ | 74AHCT125 level shifter | 1 | 3 | 3.3 V → 5 V logic margin. Skip if the strip is happy at 3.3 V |

## E. Fasteners & structure

| ✓ | Item | Qty | ~$ | Notes |
|---|---|---|---|---|
| ☐ | **M3 threaded rod or standoff set**, 100 mm+ reach | 4 | 12 | The stack skeleton — runs through the decks' measured **82 × 82 mm** corner holes |
| ☐ | **M2.5 nylon standoff + screw kit** | 1 kit | 9 | Mounts breakouts to trays |
| ☐ | **M3 brass heat-set inserts** + M3×8/12 screws | 1 kit | 14 | Printed threads strip after a few teardowns; inserts don't |
| ☐ | Zip ties, small (100 mm) | 1 bag | 4 | The trays have zip-tie slots for odd-shaped boards |
| ☐ | Double-sided foam tape (thin) | 1 | 4 | For breakouts with no mounting holes |

## F. Filament

| ✓ | Item | Qty | ~$ | Notes |
|---|---|---|---|---|
| ☐ | **PETG — dark blue or black** | 1 kg | 25 | Body, decks, wings. **Not PLA** — it lives under display lights, and we know what creep does |
| ☐ | **PETG — clear/natural** | 0.5 kg | 15 | Window panel + LED diffusers |
| ☐ | PETG — white or silver (optional) | 0.5 kg | 15 | Nice contrast for the pedestal / mimicked cell grid if you have AMS |

---

## Phase 1 total ≈ **$235–265**

## Phase 2 (add later, ~$55)
Solar: 4× encapsulated 60 × 36 mm panels · 2× INA3221 (Qwiic) · 3×AA NiMH
holder + cells · CN3791 charger · 1N5819 diodes. Plus a NEO-8M GPS if you ever
want a real fix outdoors. The CAD reserves space and routing for all of it.

---

## Three things to double-check at checkout

1. **"STEMMA QT" / "Qwiic" in the product title** for B-section items — not just
   "I2C". That word is the difference between plug-together and soldering.
2. **"Pi Zero" on the camera cable** — the standard 15-pin cable will not fit.
3. **microSD from a reputable seller.** The counterfeit we hit reported 2 TB,
   passed a flash and a boot, then destroyed itself under Docker write load.
   Cheap "2 TB" cards are always fake.

## What you can print before anything arrives

The shell and decks need no electronics:
- `obj_4_part 1.2.stl` (shell), `obj_1/2/3` (three decks), `obj_5_part 3.2.stl`
- Print in PETG and dry-fit the stack on the M3 rods

That's the weekend's printing sorted while parts ship.
