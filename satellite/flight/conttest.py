#!/usr/bin/env python3
"""
conttest.py - use the Pi as a continuity tester for SDA and SCL.

Takes GPIO2/3 off I2C, sets them as inputs with pull-ups, and watches them. Touch
the far end of a wire to GROUND and the corresponding pin reads LOW - which
proves the wire actually connects. Restores I2C on exit.

Safe: the pins are INPUTS, so grounding them drives nothing.
"""
import subprocess, time, sys

def pc(*a):
    return subprocess.run(["pinctrl"]+list(a), capture_output=True, text=True).stdout

print("  taking GPIO2 (SDA, pin 3) and GPIO3 (SCL, pin 5) off I2C...")
pc("set","2","ip","pu"); pc("set","3","ip","pu")
print("  both should read HIGH now:")
print("   ", pc("get","2,3").strip().replace("\n","\n    "))
print()
print("  TOUCH the PCA9685's SDA pin to any GND, then its SCL pin to GND.")
print("  Watching for 45 seconds. A LOW means that wire is connected.\n")
seen = {"2": False, "3": False}
t0 = time.time()
last = None
try:
    while time.time() - t0 < 45:
        out = pc("get","2,3")
        lo = [g for g in ("2","3") if f" {g}: " in out and "| lo" in
              [l for l in out.split("\n") if l.strip().startswith(g+":")][0]]
        state = tuple(lo)
        if state != last:
            if lo:
                for g in lo:
                    seen[g] = True
                    nm = "SDA (Pi pin 3)" if g=="2" else "SCL (Pi pin 5)"
                    print(f"    *** {nm} went LOW  ->  that wire IS connected")
            last = state
        time.sleep(0.12)
except KeyboardInterrupt:
    pass
print("\n  RESULT")
for g,nm in (("2","SDA / Pi pin 3"),("3","SCL / Pi pin 5")):
    print(f"    {nm:<18} {'CONNECTED' if seen[g] else 'no continuity seen'}")
pc("set","2","a0"); pc("set","3","a0")
print("\n  I2C restored:", pc("get","2,3").strip().replace("\n"," | "))
