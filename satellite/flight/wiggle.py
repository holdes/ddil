#!/usr/bin/env python3
"""
wiggle.py - drive a header pin high/low so you can watch it on a meter.

Static voltage on SDA/SCL only proves the Pi's pull-up is alive. Toggling the
pin and seeing it change AT THE FAR END proves the wire carries.

  python3 wiggle.py scl      pin 5  / GPIO3
  python3 wiggle.py sda      pin 3  / GPIO2
  python3 wiggle.py mosi     pin 19 / GPIO10  -> strip D
  python3 wiggle.py sck      pin 23 / GPIO11  -> strip C
  python3 wiggle.py both     alternates SDA+SCL, 2 s each

After today, do NOT assume a pin works because software says so. GPIO2/3 read
and toggled perfectly while being electrically dead for I2C - only a device on
the far end proved otherwise.

Put the black probe on ground and the red probe on the PCA9685's SCL (or SDA)
pin. A wire that carries will swing 3.3 V <-> 0 V in step with the printout.
Restores I2C on exit.
"""
import subprocess, sys, time

MAP = {"sda": (2, 3, "SDA"), "scl": (3, 5, "SCL"),
       "mosi": (10, 19, "MOSI / strip D"), "sck": (11, 23, "SCK / strip C")}
def pc(*a): return subprocess.run(["pinctrl"]+list(a), capture_output=True, text=True).stdout

arg = (sys.argv[1] if len(sys.argv) > 1 else "scl").lower()
sel = ["sda", "scl"] if arg == "both" else [arg]
if any(s not in MAP for s in sel):
    print(__doc__); sys.exit(1)

for s in sel:
    g, phys, nm = MAP[s]
    print(f"  driving GPIO{g}  =  physical pin {phys}  ({nm})")
print("\n  Probe the PCA9685's pin. 30 seconds. Watch the meter.\n")
try:
    t0 = time.time()
    while time.time() - t0 < 30:
        for lvl, txt in (("dl", "LOW  — meter should read ~0 V"),
                         ("dh", "HIGH — meter should read ~3.3 V")):
            for s in sel:
                pc("set", str(MAP[s][0]), "op", lvl)
            names = "/".join(MAP[s][2] for s in sel)
            print(f"    {names}  {txt}", flush=True)
            time.sleep(2.0)
except KeyboardInterrupt:
    pass
for s in sel:
    pc("set", str(MAP[s][0]), "a0")
print("\n  I2C restored:", pc("get", "2,3").strip().replace("\n", " | "))
print("\n  If it swung 0 <-> 3.3 at the board, that wire is GOOD.")
print("  If it sat still, the wire is not carrying - regardless of what it reads statically.")
