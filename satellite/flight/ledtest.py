#!/usr/bin/env python3
"""
ledtest.py - SK9822 diagnostic. Holds a solid colour so you can look at it,
wiggle connections, and probe, instead of chasing a 1-second cycle.

TWO THINGS SK9822 DOES DIFFERENTLY FROM APA102, both of which produce
"nothing happens" if you write APA102 code:

  1. END FRAME IS ZEROS, not 0xFF. APA102 wants 1-bits to push data down the
     chain; SK9822 wants a 32-bit reset frame of 0x00.
  2. IT LATCHES ONE FRAME LATE. An SK9822 displays what it was sent on the
     PREVIOUS frame, so a single transmission shows nothing at all. You have to
     send twice.

  python3 ledtest.py [n] [seconds] [speed_hz]

The strip is CUT TO 12 - that is what the cap's seat holds, at 6.94 mm pitch.
Sending more than 12 is harmless (surplus data falls off the end) but pointless.
"""
import sys, time, spidev

n     = int(sys.argv[1]) if len(sys.argv) > 1 else 12   # strip cut to 12
secs  = float(sys.argv[2]) if len(sys.argv) > 2 else 25
speed = int(sys.argv[3]) if len(sys.argv) > 3 else 1000000
import os
_B = max(1, min(31, int(os.environ.get("BRIGHT", 6))))
BRIGHT = 0xE0 | _B                     # 5-bit global current limit, 1-31

def frame(b, g, r):
    return [0, 0, 0, 0] + [BRIGHT, b, g, r] * n + [0, 0, 0, 0]

spi = spidev.SpiDev(); spi.open(0, 0)
spi.max_speed_hz = speed
spi.mode = 0                            # SK9822 is CPOL=0 CPHA=0
print(f"  {n} LEDs, {speed/1e6:.1f} MHz, mode {spi.mode}, bright {_B}/31, holding {secs:.0f}s")
print(f"  frame is {len(frame(0,0,0))} bytes")

t0 = time.time()
seq = [("RED", (0, 0, 255)), ("GREEN", (0, 255, 0)), ("BLUE", (255, 0, 0)),
       ("WHITE", (90, 90, 90))]
i = 0
while time.time() - t0 < secs:
    name, c = seq[i % len(seq)]
    f = frame(*c)
    spi.xfer2(list(f))
    spi.xfer2(list(f))                  # twice - the latch is one frame behind
    print(f"  {name:6} held", flush=True)
    hold = time.time()
    while time.time() - hold < secs / len(seq):
        spi.xfer2(list(f))              # keep refreshing so it stays lit
        time.sleep(0.05)
    i += 1
spi.xfer2(frame(0, 0, 0)); spi.xfer2(frame(0, 0, 0))
spi.close()
print("  done, blanked")
