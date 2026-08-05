#!/usr/bin/env python3
"""
wings.py - drive both wings.

  python3 wings.py alt   [max]   ALTERNATING - one at a time. Always safe.
  python3 wings.py sync  [max]   TOGETHER - both at once. Tests the rail.
  python3 wings.py sweep [max]   slow stepped sweep, both, alternating

WHY TWO MODES. The power budget says one servo at a time: 2x MG90S stalling
together is ~1.4 A on top of the Pi's 0.35 A against a 1.8 A cell. But a demo
where both wings move together looks far better than one where they take turns,
so it is worth knowing whether this build can actually do it rather than
assuming it cannot.

'sync' ramps up gently and checks the rail at every step. It is the honest test.
If the Pi reboots during it, that IS the answer - and the demo uses 'alt'.

Measured 4 Aug: +/-45 alternating, released after each move, 1.8 s apart, ran
37 moves with throttled=0x0 throughout. A +/-60 run that HELD position 0.75 s
back-to-back rebooted the Pi. The duty cycle matters more than the angle.
"""
import math
import subprocess
import sys
import time

from pca9685 import PCA9685

CH = {"P": 0, "S": 1}
SETTLE, GAP = 0.5, 1.3


def rail():
    return subprocess.run(["vcgencmd", "get_throttled"],
                          capture_output=True, text=True).stdout.strip()


def ok():
    return rail().endswith("0x0")


def alt(p, mx):
    print(f"  ALTERNATING  +/-{mx} deg - one servo at a time\n")
    for a in (0, -mx, 0, mx, 0):
        for nm, ch in CH.items():
            p.angle(ch, a); time.sleep(SETTLE); p.off(ch)
            print(f"    wing {nm}  {a:+4d}   {rail()}", flush=True)
            time.sleep(GAP)


def glide_both(p, a0, a1, dur=1.4, hz=50):
    """Ease BOTH channels through the same move, on one clock.

    Stepping them in the same loop is what makes it look like one mechanism
    instead of two servos that happen to be running. Gliding also lowers peak
    draw, which matters more here than anywhere else - this is the only moment
    both motors pull at once.
    """
    n = max(2, int(dur * hz))
    for i in range(n + 1):
        t = i / n
        e = 0.5 - 0.5 * math.cos(math.pi * t)
        for ch in CH.values():
            p.angle(ch, a0 + (a1 - a0) * e)
        time.sleep(dur / n)
    return a1


def sync(p, mx):
    print(f"  TOGETHER, gliding - ramping to +/-{mx} deg, rail checked each move\n")
    at = 0.0
    for a in [0] + [s * d for d in range(10, mx + 1, 5) for s in (-1, 1)] + [0]:
        if not ok():
            print(f"    ABORT at {a:+d} - rail sagging ({rail()})")
            return False
        glide_both(p, at, a, dur=1.0)
        at = a
        time.sleep(0.25)
        for ch in CH.values():
            p.off(ch)
        print(f"    both  {a:+4d}   {rail()}", flush=True)
        time.sleep(GAP)
    return True


def sweep(p, mx):
    print(f"  STEPPED SWEEP, both wings alternating, 5 deg steps to +/-{mx}\n")
    seq = list(range(0, mx + 1, 5)) + list(range(mx - 5, -mx - 1, -5)) + \
          list(range(-mx + 5, 1, 5))
    for a in seq:
        for nm, ch in CH.items():
            p.angle(ch, a); time.sleep(0.35); p.off(ch)
        print(f"    both at {a:+4d}   {rail()}", flush=True)
        if not ok():
            print("    RAIL SAGGING - stopping"); break
        time.sleep(0.9)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "alt"
    mx = int(sys.argv[2]) if len(sys.argv) > 2 else 45
    p = PCA9685()
    print(f"\n  wings.py  mode={mode}  max={mx}  rail {rail()}\n")
    try:
        {"alt": alt, "sync": sync, "sweep": sweep}.get(mode, alt)(p, mx)
    except KeyboardInterrupt:
        print("\n  stopped")
    finally:
        for ch in CH.values():
            p.angle(ch, 0)
        time.sleep(0.4)
        p.all_off()
        print(f"\n  both centred and released.  rail {rail()}")
