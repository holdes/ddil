# 10 — Connection register

**The authoritative list.** Every connection in the satellite, what it joins,
how it is made, and — critically — **whether it has been proven on hardware or
is still an assumption.**

Written 3 Aug 2026 after the bench session that found the Pi's hardware I²C
dead. Supersedes the pin assignments in `08-pinout.md` and `09-hookup.md`
wherever they disagree.

| Status | Meaning |
|---|---|
| ✅ **PROVEN** | measured or observed working on this hardware |
| ⚠️ **ASSUMED** | reasonable, never tested — treat as suspect |
| ❌ **FAILED** | tested and did not work |

---

## THE ONE THING THAT CHANGES EVERYTHING

> ### Pi pins 3 and 5 are DEAD.
>
> GPIO2 and GPIO3 no longer work open-drain. They still read high, drive as
> outputs, and measure correctly on a meter — which is exactly why this took a
> morning to find. Nothing ever acknowledges on them.
>
> **I²C runs on a software bus:** `dtoverlay=i2c-gpio,i2c_gpio_sda=23,i2c_gpio_scl=24,bus=3`
> in `/boot/firmware/config.txt`. That is **pins 16 and 18**, and `i2cdetect`
> must be told **`-y 3`**.
>
> ⚠️ **If the SD card is ever reflashed, that line must go back**, or nothing on
> I²C works and it will look like a brand-new fault.

Proven by moving the same board, same wires, same power onto bit-banged pins:
`0x40` appeared instantly.

---

## 1. Component inventory

| Component | Where it lives | Interface |
|---|---|---|
| Raspberry Pi Zero 2 W | deck B, on `pi_carrier` | — |
| PiSugar S UPS | under the Pi | pogo pins |
| PCA9685 servo driver (HW-170) | **deck A**, foam-taped at (0, −25) | I²C + screw terminal |
| MG90S servo × 2 | deck B, in `servo_bracket` | 3-pin to PCA9685 |
| SK9822 strip, 12 of 144 used | under the cap | SPI |
| BME280 (SparkFun Qwiic) | deck A (−28, +25) | Qwiic |
| Modulino Movement IMU | deck A (+13, +26) | Qwiic |
| Arducam UC-261 | deck B, `camera_bracket` | CSI ribbon |

**Not used:** Qwiic pHAT (wired to the dead pins, and does not fit on deck A —
65 × 30 with no clear space), HiLetgo level shifter (I²C type, too slow for
SPI), the loose 1000 µF caps (the PCA9685 already carries one).

---

## 2. Power

| From | To | How | Status |
|---|---|---|---|
| PiSugar S | Pi 5 V rail | pogo pins, no wires | ✅ PROVEN |

⚠️ **The PiSugar's pogo pins are an exposed 5 V surface.** They put 5 V onto an
I²C line during bench work and are the prime suspect for the dead GPIO2/3.
**Tape over them whenever the stack is open.**

---

## 3. I²C bus — software, bus 3

Four wires, **female Dupont onto the Pi's header pins**. No soldering.

| Pi pin | Signal | → PCA9685 | Status |
|---|---|---|---|
| **1** | 3.3 V | `VCC` | ✅ measured 3.28 V |
| **6** | GND | `GND` | ✅ continuity confirmed |
| **16** | GPIO23 → SDA | `SDA` | ✅ 0x40 responds |
| **18** | GPIO24 → SCL | `SCL` | ✅ 0x40 responds |

`OE` and `V+` on that header stay **empty**.

⚠️ **`VCC` and `V+` are adjacent. `SDA` and `SCL` are adjacent.** Read the
silkscreen at each pin. One position off is how two boards died today.

**Devices on the bus:** `0x40` (PCA9685) and `0x70` (its All-Call address).

---

## 4. Servo power — the separate supply

| Pi pin | To | How | Status |
|---|---|---|---|
| **2** | screw terminal `+` | screw, bare wire | ✅ servos move |
| **9** | screw terminal `−` | screw, bare wire | ✅ |

**`VCC` does not power the servos.** Wire only the I²C four and the board
answers on the bus while the servos barely twitch — no error, nothing to
diagnose. This is the most common failure with this part.

Strip 7 mm, twist, tighten, **tug each wire to check it clamped**.

---

## 5. Servos

| Servo | PCA9685 channel | Status |
|---|---|---|
| **P** (+X wing) | **0** | ✅ moves |
| **S** (−X wing) | **1** | ✅ moves |

**Plug orientation — match the colours, don't count pins:**

```
servo ORANGE  →  YELLOW pin   (signal)
servo RED     →  RED pin      (5 V)
servo BROWN   →  BLACK pin    (ground)
```

⚠️ Reversed will not move and can destroy the servo.

⚠️ **One servo at a time.** Two MG90S stalling together is ≈1.4 A on top of the
Pi's 0.35 A against a 1.8 A cell.

**Rail under load: `throttled=0x0`** after driving both servos and the strip.
The PCA9685's onboard **1000 µF** is doing its job — do not add the loose caps.

⚠️ **ASSUMED: travel limits.** Never measured. `bench.py sweep P` steps in 15°;
Ctrl-C where the wing fouls. That angle must be hard-clamped in the flight
agent, because commands arrive over the network including malformed ones.

---

## 6. LED strip — SPI

Four wires, direct to the header. **Working as wired.**

| Pi pin | Signal | Strip pad | Status |
|---|---|---|---|
| **4** | 5 V | `5V` | ✅ |
| **20** | GND | `G` | ✅ |
| **19** | MOSI | `D` — data | ✅ |
| **23** | SCK | `C` — clock | ✅ |

5 V comes from **pin 4**, not pin 2 — so the strip and the servo rail don't
share one header pin's contact resistance.

**No level shifter.** The HiLetgo is a bidirectional I²C type good to a few
hundred kHz; this bus runs at 1–2 MHz. SK9822 takes 3.3 V logic directly.

⚠️ **Record the wire colours as you actually built it.** The strip works, so
whatever you wired is correct — write it down before the pigtail gets
disturbed.

⚠️ **Cut off or insulate the voltage-adding wire.** Bare 5 V flying leads in a
1U with a lithium cell is the most hazardous thing in the build, and it is not
needed for 12 LEDs.

---

## 7. Sensors — NOT YET PROVEN

⚠️ **Nothing here has been seen on the bus.** The BME280 was very likely
destroyed by the 5 V event. The IMU has never been connected.

**This is the only soldering in the build.**

The PCA9685 has **two 6-pin headers wired in parallel** — one populated, one
bare through-holes. The bare one is a bus tap. Confirmed empirically: driving
SCL showed up at the unpopulated footprint.

### Solder job — 4 male header pins

Into the **bare** 6-pin footprint only:

```
V+    VCC    SDA    SCL    OE    GND
      ↑      ↑      ↑            ↑
      solder these four. Skip V+ and OE.
```

### Then chain

| From | To | How |
|---|---|---|
| PCA9685 bare header | cut Qwiic cable | red→`VCC`, black→`GND`, blue→`SDA`, yellow→`SCL` |
| Qwiic cable (uncut end) | BME280 | keyed plug |
| BME280 second socket | Modulino IMU | Qwiic cable |

Qwiic connectors are keyed and cannot go in backwards.

### Status, 3 Aug — the chain is PROVEN, the BME280 is not

✅ **The soldered chain works.** 3.3 V and ground reach the sensor through four
soldered joints, the pHAT and two cables — confirmed by the sensor's own power
LED lighting. Those joints are good.

❌ **The BME280 is DEAD.** Powered (LED on), no response at 0x76 or 0x77
(errno 6, ENXIO). It was on the bus when 5 V reached the 3.3 V rail, and
earlier that day it was clamping SCL low — a damaged-I/O signature. Not a
wiring fault.

**Replacement is a plug swap.** Qwiic is keyed and solderless, so a new BME280
drops onto the proven chain with nothing to rework. That is the whole reason
the Qwiic path was chosen over pin headers.

⚠️ **STILL UNPROVEN: SDA and SCL through the chain.** Power is confirmed; the
data lines are not. Plugging in the Modulino IMU settles it — if it appears at
0x6A or 0x6B, everything built on 3 Aug is verified end to end.

---

## 8. Camera

| From | To | How | Status |
|---|---|---|---|
| Arducam UC-261 | Pi CSI connector | 22-pin 0.5 mm ribbon | ❌ **not detected** |

**Contacts face DOWN**, toward the PCB, on a Pi Zero.

`rpicam-hello --list-cameras` returns "No cameras available". Unknown whether
the ribbon is connected at all. If it is, check orientation first, then whether
this Arducam needs its own overlay rather than autodetect.

---

## 9. The complete soldering list

**Eight joints. That is all.**

| # | Job | Where | Blocks |
|---|---|---|---|
| 1–4 | male header pins into `VCC`, `SDA`, `SCL`, `GND` | PCA9685's **bare** 6-pin footprint | the sensors |
| 5–8 | tin the four pigtail wires | LED strip's mating connector | nothing — do it now |

Everything else in this satellite is a plug, a screw terminal, or a Dupont
jumper.

---

## 9b. Build status — end of 4 Aug

**Mechanical: complete.**

| | |
|---|---|
| Frame, decks, camera + servo brackets | printed, fitted |
| Wings | printed, both move |
| Panels — camera, wing-pass, top, **ports** | printed, fitted |
| Pedestal — base, **tube**, **plate** | printed, both joints fit |
| `pi_carrier` | printed, fitted |

**Electrical: proven under load.**

| | |
|---|---|
| Software I2C, PCA9685 at 0x40 | ✅ |
| Both servos, together, gliding, +/-45 | ✅ no mechanical fouling |
| SK9822, 12 addressed | ✅ |
| Rail through all of it | `throttled=0x0` |

**MEASURED ENVELOPE — this is what the flight agent must respect:**

* **+/-45 deg** sweeps freely, no fouling. A 37-move stepped sweep held 0x0.
* **Release after every move.** A held servo buzzes and draws continuously.
* **Glide, do not jump.** Eased motion never asks a motor for full speed from
  rest - which is why BOTH wings can move together on one cell, against the
  original one-at-a-time rule.
* The +/-60 reboot came from HOLDING position back-to-back. The duty cycle
  matters more than the angle.

## 10. Still open

| | |
|---|---|
| Servo travel limits | ✅ **CLOSED** — ±45 sweeps freely, no fouling |
| Replacement BME280 | on order — Qwiic, so it is a plug swap onto the proven chain |
| Sensors on the bus | ❌ BME280 dead (confirmed) · IMU untested |
| SDA/SCL through the sensor chain | ⚠️ power proven end-to-end, data lines not |
| Camera | ❌ **ribbon latch broken** — try taping the ribbon down; the packet has a `CameraAvailable` flag for exactly this |
| Servo lead length | ⚠️ never measured; schedule needs 107 mm |
| Flight agent | ✅ **UNBLOCKED** — `pisat_sim.py`, the COSMOS target definitions and a byte-verified reference packet are all local. Plane work. |

---

Next: [08 — Pinout reference](08-pinout.md) · [09 — Hookup guide](09-hookup.md)
