#!/usr/bin/env python3
"""
demo.py - all-systems demo. Wings feather, LEDs follow.

  python3 demo.py            one full pass
  python3 demo.py loop       repeat until Ctrl-C
  python3 demo.py alert      just the SPACECOP alert look

  BRIGHT=16 python3 demo.py  turn it up (1-31, default 6)

BRIGHTNESS. The SK9822 has TWO controls that multiply: a 5-bit global current
limit (BRIGHT, 0-31) and 8-bit PWM per colour channel. At BRIGHT=6 with the
colours below you are at roughly 8 % of the strip's output, which is very
conservative. 12 LEDs at FULL white is 0.72 A on its own - against a 1.8 A cell
that also feeds the Pi (0.35 A) and a servo (up to 0.7 A), so the ceiling is
real, but there is a lot of room below it.

    BRIGHT   12 LEDs, white     headroom alongside a moving servo
       6        ~0.06 A         huge
      12        ~0.12 A         comfortable  <- try this first
      20        ~0.20 A         fine
      31        ~0.31 A         still OK at these colour values
      31 + (255,255,255)  0.72 A   marginal - watch throttled

EVERY POWER RULE IS ENFORCED HERE, not left to the operator:

  * ONE SERVO AT A TIME. Two MG90S stalling together is ~1.4 A on top of the
    Pi's 0.35 A against a 1.8 A cell.
  * RELEASED AFTER EVERY MOVE. A servo left holding draws current continuously
    and fights its own gearing. This is what kept the rail clean on the bench.
  * TRAVEL CLAMPED to +/-MAX_DEG. A +/-60 deg back-to-back run rebooted the Pi
    on 3 Aug; +/-35 with a wing attached did not.
  * BRIGHTNESS CAPPED. 12 LEDs at full white is 0.72 A on its own.
  * RAIL WATCHED. If vcgencmd reports undervoltage the run aborts rather than
    browning out mid-demo.

The LED animation runs DURING each servo's settle time, so the two look
choreographed rather than sequential - and it costs no extra seconds.
"""
import math
import subprocess
import sys
import time

import os

import spidev
from pca9685 import PCA9685

# ---- limits, all measured on 3 Aug ---------------------------------------
# +/-45 MEASURED 4 Aug: the wing sweeps that far with NO mechanical fouling,
# and a 37-move stepped sweep held throttled=0x0 throughout. The earlier +/-60
# reboot came from HOLDING position back-to-back, not from the angle - gliding
# and releasing is what makes the range safe.
MAX_DEG = 45.0
SETTLE = 0.35           # after the glide, let it settle before releasing
GLIDE = 1.6             # seconds per move - slower reads better to an audience
GAP = 0.9               # recovery between moves
N_LED = 12              # of 144 - only these are under the diffuser
BRIGHT = int(os.environ.get('BRIGHT', 6))   # of 31 - see the docstring
CH = {"P": 0, "S": 1}

RED, AMBER, GREEN, BLUE, WHITE = ((0, 0, 255), (0, 140, 255), (0, 255, 0),
                                  (255, 0, 0), (110, 110, 110))


def rail_ok():
    out = subprocess.run(["vcgencmd", "get_throttled"],
                         capture_output=True, text=True).stdout.strip()
    return out.endswith("0x0"), out


class Strip:
    """SK9822. Note it latches ONE FRAME LATE - every write goes out twice."""

    def __init__(self, n=N_LED, hz=1_000_000):
        self.n = n
        self.spi = spidev.SpiDev()
        self.spi.open(0, 0)
        self.spi.max_speed_hz = hz
        self.spi.mode = 0

    def _send(self, pix):
        buf = [0, 0, 0, 0]
        for b, g, r in pix:
            buf += [0xE0 | BRIGHT, b, g, r]
        buf += [0, 0, 0, 0]
        self.spi.xfer2(list(buf))
        self.spi.xfer2(list(buf))

    def fill(self, c):
        self._send([c] * self.n)

    def off(self):
        self.fill((0, 0, 0))

    def chase(self, c, secs, period=0.06):
        """A lit head running the strip - reads as 'working' at a glance."""
        t0 = time.time()
        i = 0
        while time.time() - t0 < secs:
            pix = [(0, 0, 0)] * self.n
            for k, f in ((0, 1.0), (1, 0.35), (2, 0.12)):
                j = (i - k) % self.n
                pix[j] = tuple(int(v * f) for v in c)
            self._send(pix)
            time.sleep(period)
            i = (i + 1) % self.n

    def pulse(self, c, secs, period=0.045):
        """Breathing - used for the alert, which must read as urgent."""
        t0 = time.time()
        while time.time() - t0 < secs:
            for lv in list(range(0, 11)) + list(range(10, -1, -1)):
                if time.time() - t0 >= secs:
                    break
                self.fill(tuple(int(v * lv / 10.0) for v in c))
                time.sleep(period)

    def close(self):
        self.off()
        self.spi.close()


# where the wings are, so a glide starts from the truth
_AT = 0.0


def wings(pca, strip, deg, colour, dur=GLIDE):
    """Glide BOTH wings together, strip tracking the travel, then release.

    Together, not in turn. The power budget said one servo at a time and that
    was right for a jump - a stalled MG90S pair is ~1.4 A. Gliding never asks
    either motor for full speed from rest, and a ramp to +/-30 with both moving
    held throttled=0x0 on 4 Aug. Two wings in unison read as one mechanism;
    taking turns reads as two servos.
    """
    global _AT
    deg = max(-MAX_DEG, min(MAX_DEG, deg))
    ok, flags = rail_ok()
    if not ok:
        raise RuntimeError(f"rail sagging ({flags}) - aborting before it reboots")

    a0, n = _AT, max(2, int(dur * 50))
    for i in range(n + 1):
        t = i / n
        e = 0.5 - 0.5 * math.cos(math.pi * t)
        pos = a0 + (deg - a0) * e
        for ch in CH.values():
            pca.angle(ch, pos)
        if i % 4 == 0:
            lvl = 0.30 + 0.70 * math.sin(math.pi * t)   # brightest mid-travel
            strip.fill(tuple(int(v * lvl) for v in colour))
        time.sleep(dur / n)
    _AT = deg

    time.sleep(SETTLE)
    for ch in CH.values():
        pca.off(ch)                 # release - this is what keeps the rail up
    strip.fill(tuple(int(v * 0.25) for v in colour))
    time.sleep(GAP)


def sequence(pca, strip):
    print("  1. self-test", flush=True)
    strip.chase(WHITE, 1.6)

    print("  2. nominal", flush=True)
    strip.fill(GREEN)
    time.sleep(0.7)

    print("  3. wings feathering - both together", flush=True)
    for a in (-MAX_DEG, MAX_DEG, 0):
        wings(pca, strip, a, AMBER, dur=1.6)

    print("  5. SPACECOP alert", flush=True)
    strip.pulse(RED, 2.6)

    print("  6. recovered", flush=True)
    strip.fill(GREEN)
    time.sleep(1.0)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "once"
    pca, strip = PCA9685(), Strip()
    ok, flags = rail_ok()
    print(f"\n  CubeSat demo   rail {flags}   {N_LED} LED  "
          f"bright {BRIGHT}/31  +/-{MAX_DEG:.0f} deg\n")
    try:
        if mode == "alert":
            strip.pulse(RED, 6.0)
        else:
            while True:
                sequence(pca, strip)
                if mode != "loop":
                    break
                print("  --- loop ---\n")
    except KeyboardInterrupt:
        print("\n  stopped")
    except RuntimeError as e:
        print(f"\n  ABORTED: {e}")
    finally:
        pca.all_off()
        strip.close()
        ok, flags = rail_ok()
        print(f"\n  all released, strip blank.  rail {flags}")


if __name__ == "__main__":
    main()
