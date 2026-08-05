#!/usr/bin/env python3
"""
findpin.py - identify WHICH physical pin a wire is plugged into.

Sets every usable GPIO to input with a pull-up, then watches. Ground the far end
of a wire and this reports the physical pin number it is actually on - which
settles "am I counting from the right end" without a multimeter.
"""
import subprocess, time

BCM2PHYS = {2:3,3:5,4:7,14:8,15:10,17:11,18:12,27:13,22:15,23:16,24:18,
            10:19,9:21,25:22,11:23,8:24,7:26,5:29,6:31,12:32,13:33,
            19:35,16:36,26:37,20:38,21:40}
G = sorted(BCM2PHYS)
def pc(*a): return subprocess.run(["pinctrl"]+list(a),capture_output=True,text=True).stdout

prev = {}
for g in G:
    prev[g] = pc("get",str(g)).strip()
    pc("set",str(g),"ip","pu")
time.sleep(0.2)
lst = ",".join(str(g) for g in G)
base = pc("get",lst)
stuck = [g for g in G if f"\n{g:2d}: " in "\n"+base and "| lo" in
         [l for l in base.split("\n") if l.strip().startswith(str(g)+":")][0]]
print("  all GPIO now inputs with pull-ups.")
if stuck:
    print("  already LOW (tied to ground somewhere): " +
          ", ".join(f"pin {BCM2PHYS[g]}" for g in stuck))
print("\n  GROUND the far end of a wire. 50 s.\n")

hits=[]; t0=time.time(); last=set()
try:
    while time.time()-t0 < 50:
        out = pc("get",lst)
        lo=set()
        for l in out.split("\n"):
            l=l.strip()
            if ":" in l and "| lo" in l:
                try: g=int(l.split(":")[0])
                except: continue
                if g in BCM2PHYS: lo.add(g)
        new = lo - last - set(stuck)
        for g in sorted(new):
            print(f"    *** that wire is on PHYSICAL PIN {BCM2PHYS[g]}   (GPIO{g})")
            hits.append(BCM2PHYS[g])
        last = lo
        time.sleep(0.1)
except KeyboardInterrupt: pass

print("\n  FOUND: " + (", ".join(f"pin {p}" for p in hits) if hits else "nothing grounded"))
for g in G:
    if "a0" in prev[g]: pc("set",str(g),"a0")
    elif "a3" in prev[g]: pc("set",str(g),"a3")
    else: pc("set",str(g),"ip")
print("  restored:", pc("get","2,3").strip().replace("\n"," | "))
