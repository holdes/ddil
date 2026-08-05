# 09 — Hookup guide

**Literal, step by step. Assumes no prior electronics experience.**

Read the four rules first. They prevent every mistake in this build that
damages hardware rather than just not working.

---

## Four rules

1. **Power off before you plug or unplug anything.** Not sleeping — off, and the
   PiSugar's switch off too. Hot-plugging is how boards die.
2. **Never force a connector.** Every connector here fits one way with light
   pressure. If it resists, it is wrong way round or misaligned.
3. **Red is +, black or brown is −.** Swapping them destroys parts instantly.
   Check twice before power goes on.
4. **One servo at a time during testing.** Two together can brown out the Pi.

---

## How to read the 40-pin header

You need this for the servo and LED steps.

The header is **two rows of 20 pins**. They are numbered in a zig-zag, not along
the rows:

```
   pin 1  pin 2
   pin 3  pin 4
   pin 5  pin 6
     ...    ...
   pin 39 pin 40
```

**Odd numbers are all in one row. Even numbers are all in the other.**

**Finding pin 1:** turn the Pi over. Every Raspberry Pi marks pin 1 with a
**square** solder pad — all 39 others are round. That square pad is pin 1. It is
at the end of the header nearest the **microSD card slot**.

Once you have pin 1, count in pairs down the board: 1-2, 3-4, 5-6, and so on.

---

## Step 1 — PiSugar onto the Pi Zero

The PiSugar is the battery board. It goes **underneath** the Pi.

1. Battery switch **off**.
2. Line the PiSugar up under the Pi so the four corner holes match. It only
   lines up one way — the spring-loaded **pogo pins** (little gold plungers) must
   press against the flat gold pads on the Pi's underside.
3. Screw it together with the standoffs in the PiSugar kit.

**Check:** the pogo pins are compressed and touching. No wires. This connection
is entirely through those pins.

⚠ The battery cell sits **above** the PiSugar board. Nothing goes under it.

---

## Step 2 — Qwiic pHAT onto the Pi

The pHAT is the board with the small white **Qwiic** sockets on it.

1. The pHAT has a **40-hole socket** on its underside. The Pi's 40 pins go into
   it.
2. Line up **all 40** pins. Do not let it sit one row or one column over —
   that is the single most common way to destroy a HAT.
3. Press straight down, evenly, until it stops.

**Check before power:** look along the join. No pin bent, none sticking out at
an end, both boards parallel.

---

## Step 3 — Sensors onto the Qwiic chain

Qwiic cables are the 4-wire ones with small white plugs. **They are keyed — they
physically cannot go in backwards or upside down.** This is the easiest step.

1. **150 mm** cable: any Qwiic socket on the pHAT → either socket on the
   **BME280**.
2. **100 mm** cable: the BME280's **other** socket → either socket on the
   **Modulino IMU**.

That is a daisy chain. Both sensors share one bus, so order does not matter and
there is no "in" or "out".

**Check:** push each plug until it clicks. They back out a fraction of a
millimetre and still look seated — that is the #1 cause of a blank `i2cdetect`.

**Colours, if you ever need them:** black = ground, red = 3.3 V, blue = data,
yellow = clock.

---

## Step 4 — Camera

⚠ **The step most likely to damage something.** Take your time.

The Pi Zero's camera connector is a narrow slot with a thin plastic lip.

1. Find the connector. Gently pull the lip **straight out** ~1 mm. It stays
   attached — do not pull it off.
2. The ribbon cable has **shiny metal contacts on one side only**.
3. Slide the ribbon in so the **contacts face the printed circuit board** —
   toward the Pi, not up at you. On a Pi Zero the contacts face **down**.
4. Hold the ribbon in place and push the lip back in until flush.

**Check:** tug very gently. It should not move. The ribbon should be square, not
skewed.

**If the camera is not found later,** the ribbon being in backwards is the first
thing to check, before anything else.

---

## The five pads you solder — do this first

Your pHAT has a column of 18 labelled holes. **Only five are used.** Solder a
male header pin into each, then everything else plugs on with jumper wires.

Count holes from the **top** of the column:

| Hole | Label | Feeds |
|---|---|---|
| **1** | `5V` | LED strip **and** the PCA9685's V+ |
| **3** | `GND` | LED strip ground |
| **4** | `GND` | PCA9685 ground |
| **9** | `MOSI` | LED strip data |
| **11** | `SCK` | LED strip clock |

⚠ **Two decoys.** `MISO` (hole 10) sits between `MOSI` and `SCK`. And `D6` sits
between `D12` and `D16` further down — you do not need those two at all, but
they are the ones people grab by mistake.

The full column, for reference: 1 `5V` · 2 `3.3V` · 3 `GND` · 4 `GND` · 5 `SCL`
· 6 `SDA` · 7 `TX` · 8 `RX` · 9 `MOSI` · 10 `MISO` · 11 `SCK` · 12 `CS` ·
13 `D7` · 14 `D12` · 15 `D6` · 16 `D16` · 17 `D20` · 18 `D21`.

**That is the entire soldering job for this build.** Five through-hole pins.

---

## Step 5 — PCA9685 servo driver

The servos do **not** connect to the Pi. They connect to this board, which takes
commands over the Qwiic bus and generates the servo signals itself.

**It has two separate power inputs, and this is where people go wrong:**

| Input | Powers | Voltage |
|---|---|---|
| **VCC** | the chip's logic only | 3.3 V |
| **V+** (screw terminal) | the servos themselves | **5 V** |

Wiring VCC and forgetting V+ makes the servos twitch weakly or not move at all,
with everything appearing correct. **They are not the same supply.**

### Logic side — no soldering

Take a **spare Qwiic cable** and cut one end off. The four wires are exactly what
the logic side needs:

| Qwiic wire | PCA9685 pin |
|---|---|
| **Red** | VCC |
| **Black** | GND |
| **Blue** | SDA |
| **Yellow** | SCL |

Plug the uncut end into any free Qwiic port on the pHAT. All four ports are the
same bus, so it does not matter which.

### Servo power side

- **V+** screw terminal ← `5V` pad (hole 1)
- **GND** ← `GND` pad (**hole 4** — hole 3 is the strip's, keep them separate)

⚠ **Fit a 1000 µF capacitor across V+ and GND, right at the board.** You have a
pack of them. It absorbs the current surge when a servo starts. Without it, that
surge dips the rail and reboots the Pi.

**Capacitors have polarity.** The stripe on the side marks the **negative** leg,
which goes to GND. Backwards, they fail — sometimes loudly.

---

## Step 6 — Servos into the PCA9685

The PCA9685 has 16 channels, each a 3-pin header. **Servo plugs push straight
on** — the connector already on the MG90S is the right one.

| Servo | Channel |
|---|---|
| **P** (left / +X) | **0** |
| **S** (right / −X) | **1** |

**Orientation matters.** Each channel's three pins are labelled on the board,
usually `PWM` `V+` `GND`. The servo's **brown** wire goes to **GND** — that is
the edge of the board. If the plug is on backwards the servo will not move and
can be damaged.

Check the silkscreen on your board and match brown to GND before power.

---

## Step 7 — LED strip

Your strip is an **SK9822** with data and clock on separate wires. It takes four
connections:

| Strip wire | Goes to |
|---|---|
| **5V** | `5V` pad (hole 1) |
| **GND** | `GND` pad (hole 3) |
| **DI** / CI — data in | `MOSI` pad (hole 9) |
| **CI** — clock in | `SCK` pad (hole 11) |

**No level shifter.** Your HiLetgo converter is a bidirectional I²C type built
around pull-up resistors — it works to a few hundred kHz, and SPI here runs at
1–2 MHz. It would corrupt the signal rather than help it. SK9822 strips
generally accept 3.3 V logic when powered from 5 V, so drive them directly.

If the strip proves flaky after everything else checks out, the correct part is a
**74AHCT125** — but test first, because most likely you will not need one.

⚠ **The strip has a direction.** Small arrows are printed along it, pointing
**away** from where the data enters. Connect the end the arrows point *away
from*. Wire the wrong end and nothing lights, with no other symptom.

---

## Sharing the 5 V pad

There is **one** `5V` pad and two things need it — the strip and the PCA9685's
V+.

Either solder two wires into the one pin, or run a single wire out to a splice
connector and branch from there. Do **not** use a solderless breadboard for
this: servo inrush through breadboard contacts causes voltage dips that read
exactly like buggy code.

Ground is easier — there are two `GND` pads: hole 3 for the strip and
hole 4 for the PCA9685.

---

## Power rules

- **One battery, one 5 V rail.** Everything shares it.
- **Never move both servos at once.** Two stalling MG90S is ~1.4 A on top of the
  Pi's 0.35 A, against a 1.8 A cell.
- **Keep LED brightness low** — 12 LEDs at full white is 0.72 A by itself.
- **Every ground must connect.** A strip or shifter with a floating ground
  produces flicker that looks exactly like bad code.
- **1000 µF capacitors** across 5 V near the servo plugs, if you have them. They
  absorb the current spike when a servo starts.

---

## Order to build and test

Do not do it all then power on. Add one thing, test it, add the next — so a
fault has only one possible cause.

| # | Add | Test | Expect |
|---|---|---|---|
| 1 | nothing | `python3 bench.py power` | `throttled=0x0` |
| 2 | pHAT + sensors | `python3 bench.py i2c` | two addresses |
| 3 | camera | `python3 bench.py cam` | a camera listed |
| 4 | one servo | `python3 bench.py sweep P` | it steps, you note the limit |
| 5 | second servo | `python3 bench.py sweep S` | same |
| 6 | shifter + strip | `python3 bench.py led` | red, green, blue, white |

Re-run `power` after each. If throttling appears at a step, that step is drawing
more than the rail can give.

---

## If something does not work

| Symptom | Look here first |
|---|---|
| `i2cdetect` grid blank | Qwiic plug not fully clicked in |
| Only one sensor appears | second cable, or the two share an address |
| No camera | ribbon in backwards — contacts face the PCB |
| Servo buzzes, will not move | on 3.3 V instead of 5 V |
| Servo jitters | ground not shared, or the rail is sagging |
| Strip dark | wired to the wrong end — check the arrows |
| Strip flickers | shifter ground floating |
| Pi reboots when a servo moves | brownout — one servo at a time |

**Nothing on this list is damage.** They are all wiring, and all reversible.

---

Next: [08 — Pinout reference](08-pinout.md)
