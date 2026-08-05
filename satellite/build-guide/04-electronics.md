# 04 — Electronics

Diagram: `../diagrams/satellite-topology.svg` — power and data, with connector
types on every edge. Keep it open alongside this guide.

The whole point of the Qwiic / STEMMA QT choice is that **there is no soldering
in this section**. If you find yourself reaching for the iron for anything other
than a heat-set insert, stop — you probably have the wrong variant of a part.

---

## Power architecture

Two rails from one supply. This is not optional.

```
USB-C PSU (5 V 3 A)
├── 5 V, ~350 mA ──> Pi Zero 2 W          (logic rail)
└── 5 V in ────────> BEC / buck (2 A+)
                     ├──> MG90S servo ×2  (motor rail)
                     └──> APA102 strip    (LED rail)
```

**Why the separate rail:** servo inrush browns out a Pi Zero. You get random
reboots mid-demo, and they are maddening to diagnose because they only happen
when the wings move — i.e. only in front of an audience. The BEC costs ~$6.

Rough budget against the 3 A supply:

| Load | Draw |
|---|---|
| Pi Zero 2 W | ~350 mA |
| 2× MG90S, moving | ~500 mA (stall is much higher, but they are unloaded) |
| APA102 ×24 | ~1 A at moderate brightness (full white is ~1.4 A — don't) |
| **Total** | **~1.9 A peak**, on a 3 A supply |

☐ Cap LED brightness in software. Full-white 24 APA102s is both a current
problem and unpleasant to look at from two feet away.

---

## Build order for populating the decks

Plan drawing: `../cad/renders/views/electronics_plan.png` — to scale, structure
taken from the meshes.

**Populate both decks OFF the frame.** That is the whole reason nothing uses
heat-set inserts: every fixing is a through-bolt and you can reach both sides
until the decks go in. Once the stack is in the frame, the underside of Deck A
is gone.

| # | Step | Why in this order |
|---|---|---|
| 1 | Hammer header onto the Pi | needs a hard flat surface and both hands |
| 2 | PiSugar S onto the Pi's underside pads | pogo pins; do it before anything is bolted down |
| 3 | **Measure the assembled stack height** | must fit the **20.00 mm** bay between deck_a top and deck_b underside. If it does not, that standoff grows and the wing rises with it |
| 4 | Qwiic pHAT onto the header | |
| 5 | Pi stack onto Deck A, M2.5 through the grid | Deck A's ⌀2.70 holes are on a 10 mm grid |
| 6 | BME280 and IMU onto Deck A, Qwiic daisy-chain | sensors sit at +Y, clear of the Pi |
| 7 | Camera bracket + Arducam onto Deck B | before the panels |
| 8 | Servo brackets onto Deck B | pins first, then M3 through the slots |
| 9 | Deck A onto the standoff chain, then Deck B | |

⚠ **Step 3 is the one that gates the panels.** Everything above Deck B — the lens
bore, the shaft bore, and both split lines — is derived from Deck B's height,
the chain is **MEASURED at 20.00 mm** (6 standoff + deck_a 3 + 20 standoff + deck_b 3). Measure before the panels are cut.

### Connection map

| From | To | Interface | Notes |
|---|---|---|---|
| PiSugar S | Pi Zero underside | pogo pins | board is separate from the cell |
| PiSugar S | outside world | **USB-C** | charge port position sets `panel_ports` |
| Pi | Qwiic pHAT | 40-pin hammer header | |
| pHAT | BME280 | JST-SH Qwiic | |
| BME280 | Modulino IMU | JST-SH Qwiic | daisy-chained |
| pHAT MOSI/SCK/5V/GND | SK9822 strip | 4-wire SPI | under the cap aperture |
| pHAT **D12** | servo, port side | **hardware PWM** | |
| pHAT D16 | servo, starboard | software PWM via `pigpio` | |
| Pi CSI | Arducam UC-261 | 22-pin 0.5 mm ribbon | cable owned |

**The PCA9685 is not fitted.** It needs a second supply for its V+ rail and there
is only one battery, so it buys nothing over driving the servos straight off
GPIO. Keep it on the bench for finding travel limits.

### Cable routes

Both decks carry a **22 × 9 rounded pass-through** on the centreline — Deck A at
y +0.6, Deck B at y +8.0. The CSI ribbon is 11 mm wide and flat, which is why
those are slots and not round holes.

☐ Servo leads: down through Deck B's pass-through, into the Deck A bay
☐ CSI ribbon: Deck B pass-through, kept away from the servo leads
☐ Deck A has **four 8 × 3 zip-tie slots** at x ±36 — use them, do not rely on
  the harness staying put

⚠ **Do not run any harness through a panel bore.** Those are hardware clearance
only — the servo shaft and the lens fill them.

---

## STOP — GPIO header access

**Unverified:** whether the SparkFun Qwiic pHAT (DEV-15945) leaves the GPIO
header reachable.

The APA102 strip needs **SPI0 — GPIO10 (MOSI) and GPIO11 (SCLK)**. If the pHAT
covers the header without a pass-through or stacking connector, those pins are
unreachable and the LED wow factor has nowhere to land.

☐ When the pHAT arrives, look at it before assembling anything. If it has no
pass-through, options are a stacking header underneath it, or moving the LEDs to
a PCA9685 channel (dimmable, but you lose per-pixel colour — a real downgrade for
an IDS-alert display).

Everything else in this section is independent of that, so you can proceed and
come back.

---

## I²C chain

One daisy chain, polarity-proof JST-SH 4-pin throughout. Order does not
electrically matter; this order minimises cable length across the decks.

```
Pi Zero  ──40-pin GPIO──  Qwiic pHAT
                              │ JST-SH
                          BME280        (Floor 3, payload tray)
                              │
                          LSM6DSOX      (Floor 3)
                              │
                          PCA9685       (Floor 1, near the BEC)
```

☐ Seat the Qwiic pHAT on the Pi's GPIO header. Check it is on **all 40 pins**
and not offset by one row — the classic mistake, and it shorts 5 V into GPIO

☐ Chain BME280 → LSM6DSOX → PCA9685 with JST-SH cables. Buy longer cables than
you think; running from Floor 3 down to Floor 1 through the 20 × 20 pass-through
eats more length than it looks

☐ Route the PCA9685 leg through the pass-through using the pull-string from §02

☐ ⚠ Do not power the PCA9685's **V+** (servo power) from the Pi. V+ comes from
the BEC. The logic side is powered through the Qwiic cable; the motor side is
not, and they are separate terminals for a reason

### Sensor roles

| Board | Provides | Audience interaction |
|---|---|---|
| **BME280** | temperature, pressure, humidity | breathe on it, watch telemetry move |
| **LSM6DSOX** | gyro X/Y/Z, accel X/Y/Z | pick it up and tilt it |

Those two interactions are the demo. They are why real sensors are worth having
over simulated values.

---

## Camera

☐ ⚠ **The Pi Zero uses the narrow 22-pin 0.5 mm CSI connector.** Your Arducam
ships with the standard 15-pin cable, which physically will not fit. You need the
22-pin → 15-pin Pi Zero adapter cable. Without it the camera cannot connect at
all — this is the single most common way this build stalls

☐ Contacts face the correct way — on the Pi Zero, toward the board. Check twice;
the connector is fragile and PCB-side contacts are easy to get backwards

☐ Route the ribbon so it does not foul the wing servo harness

---

## LEDs

**APA102 / DotStar, not WS2812 / NeoPixel.** WS2812 needs bit-banged timing on a
Pi and fights the audio peripheral; APA102 is true SPI (separate clock and data)
and just works. Buy the strip **with connectors pre-attached** — that is the last
soldering iron avoided.

☐ Level-shift the Pi's 3.3 V SPI to the strip's 5 V logic. The guide used to name
a 74AHCT125; what is actually in the box is a **HiLetgo 4-channel bidirectional
shifter (×10)**, which does the same job for CLK and DATA. Some strips run happily
on 3.3 V — **bench-test the strip before committing to the shifter**, since it is
one more thing in the harness

☐ Mount the strip under the cap's 90 × 90 aperture — `panel_window` no longer
exists (see 01), and all four side faces are assigned

⚠ **There is no BEC.** This step used to say "feed the strip from the BEC" —
that dates from the tethered design. Since going untethered there is **one cell
and one 5 V rail**, and the strip shares it with everything else.

That makes the strip a power decision, not just a wiring one:

| Load | Current |
|---|---|
| 12 LEDs, full white | 0.72 A |
| 12 LEDs, capped at 30% | 0.22 A |
| Pi Zero 2 W | 0.35 A |
| one MG90S stalling | 0.70 A |

☐ **Cut the strip to 12 LEDs (83.3 mm).** 24 at full white is 1.44 A on its own
☐ **Cap brightness in software at ~30%.** 12 at full white plus the Pi plus one
  stalling servo is 1.77 A against a 1.8 A supply — no margin at all
☐ Common ground between the Pi and the strip. ⚠ This is the one wiring mistake
  that produces symptoms that look like a software bug — flickering, garbage
  colours, or nothing at all

---

## Fit and strain relief

☐ M2.5 nylon standoffs for every board that has mounting holes

☐ Zip ties through the payload tray's slots for the ones that do not; thin
double-sided foam tape as a last resort

☐ Leave **service loops** on the I²C chain. You will open this up more than you
expect, and a taut cable will pull a connector off a breakout eventually

☐ Nothing loose. It will be carried, tilted, and handed to strangers

---

## First power-on

Do this **before** closing any panels.

☐ Disconnect everything from the Pi's 5 V except the PSU

☐ Power the PSU. Measure at the BEC output with a multimeter — confirm **5 V**
before it is connected to anything. A miswired buck converter that outputs 12 V
will destroy every board downstream in one shot

☐ Power down. Connect the Pi only. Confirm it boots

☐ Power down. Connect the Qwiic chain. Boot, then `i2cdetect -y 1`

Expected addresses:

| Board | Address |
|---|---|
| BME280 | 0x76 or 0x77 |
| LSM6DSOX | 0x6A or 0x6B |
| PCA9685 | 0x40 |

☐ All three present → the chain is good. A missing board is almost always a
cable not fully seated, not a dead part

☐ Only now connect the BEC to the servo and LED rails

---

## Before moving on

- [ ] BEC output measured at 5 V before anything was connected to it
- [ ] All three I²C addresses respond
- [ ] Camera enumerates
- [ ] Common ground verified with a continuity check
- [ ] GPIO/SPI access resolved, or LEDs consciously deferred

---

Next: [05 — Wings & pedestal](05-wings-and-pedestal.md)
