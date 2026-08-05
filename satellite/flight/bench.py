#!/usr/bin/env python3
"""
bench.py - bring-up tests for the CubeSat, one subsystem at a time.

Run these WITH THE SATELLITE OPEN, before anything is buttoned up. Every check
here answers a question the flight software would otherwise have to assume.

  python3 bench.py i2c            scan the Qwiic bus
  python3 bench.py cam            camera detect + one still
  python3 bench.py servo P 90     move ONE servo to an angle
  python3 bench.py sweep P        slow sweep - find the travel limits
  python3 bench.py led 144        light the strip at a safe brightness
  python3 bench.py power          what the rails are doing

SAFETY, from the power budget in build-guide/08-pinout.md:
  * ONE servo at a time. Two MG90S stalling together is ~1.4 A on top of the
    Pi's 0.35 A, against a 1.8 A cell. This script refuses to drive both.
  * LED brightness is capped. 12 LEDs at full white is 0.72 A on its own.
"""
import sys, time

# SERVOS ARE ON THE PCA9685 NOW, NOT ON PI PINS.
# This file used to drive GPIO12 and GPIO16 directly. That was written before
# the driver board went in, and it would have run cleanly while moving nothing -
# sending me hunting a wiring fault that did not exist.
SERVO_CH = {"P": 0, "S": 1}         # PCA9685 channel numbers
LED_N, LED_BRIGHT_CAP = 12, 8       # of 31; ~25%, per the power rules


def i2c():
    import subprocess
    print("scanning /dev/i2c-3 (software bus - the hardware pins are dead) ...\n")
    # /usr/sbin is NOT on the PATH for a non-login ssh session, so the bare
    # name looks "not installed" when the package is present. Use the path.
    r = subprocess.run(["/usr/sbin/i2cdetect", "-y", "3"], capture_output=True,
                       text=True)
    print(r.stdout or r.stderr)
    print("EXPECT:  0x76 or 0x77  BME280")
    print("         0x6A or 0x6B  Modulino IMU (LSM6DSOX)")
    print("         0x57 / 0x75   PiSugar, on some models")
    print("\nBlank grid with sensors connected = check the Qwiic cable seating")
    print("first; JST-SH backs out easily and looks fine.")


def cam():
    import subprocess
    r = subprocess.run(["rpicam-hello", "--list-cameras"], capture_output=True,
                       text=True)
    print(r.stdout or r.stderr)
    if "Available cameras" not in (r.stdout or ""):
        print("\nNo camera. In order of likelihood:")
        print("  1. ribbon in backwards - contacts face the PCB on a Zero")
        print("  2. connector latch not seated")
        print("  3. Arducam sensor needing its own overlay, not autodetect")
        return
    out = "/tmp/bench-cam.jpg"
    subprocess.run(["rpicam-still", "-n", "-o", out, "-t", "800"])
    print(f"\ncaptured {out}")


def _servo(which, angle, hold=0.6):
    from pca9685 import PCA9685
    p = PCA9685()
    p.angle(SERVO_CH[which], angle)
    time.sleep(hold)
    p.off(SERVO_CH[which])          # release - a held MG90S buzzes and draws current


def servo(which, angle):
    if which not in SERVO_CH:
        print("servo must be P or S"); return
    a = max(-90.0, min(90.0, float(angle)))
    if a != float(angle):
        print(f"clamped {angle} -> {a}")
    print(f"servo {which} (PCA9685 channel {SERVO_CH[which]}) -> {a} deg")
    _servo(which, a)
    print("detached. Note the angle if this is a travel limit.")


def sweep(which):
    if which not in SERVO_CH:
        print("servo must be P or S"); return
    print(f"sweeping servo {which} in 15 deg steps. Ctrl-C the INSTANT the wing")
    print("touches anything - that angle is the limit that goes in the flight")
    print("script, and it is the number this whole test exists to find.\n")
    try:
        for a in list(range(-90, 91, 15)) + list(range(75, -91, -15)):
            print(f"  {a:+4d} deg", flush=True)
            _servo(which, a, hold=0.45)
    except KeyboardInterrupt:
        print("\nstopped - write that angle down")


def led(n=LED_N):
    """SK9822, which is NOT quite APA102. Two differences, both of which look
    like 'the strip is dead' if you write APA102 code:

      1. The end frame is 32 bits of ZERO. APA102 wants 0xFF to push data down
         the chain; SK9822 wants a reset frame.
      2. It latches ONE FRAME LATE - a single transmission displays nothing.
         Every colour has to be sent twice.

    Found by running it, not by reading it. The first version of this function
    had both bugs and still compiled and ran without error.
    """
    import spidev
    n = int(n)
    b = 0xE0 | LED_BRIGHT_CAP

    def frame(bl, g, r):
        return [0, 0, 0, 0] + [b, bl, g, r] * n + [0, 0, 0, 0]

    spi = spidev.SpiDev(); spi.open(0, 0)
    spi.max_speed_hz = 1000000
    spi.mode = 0
    for name, col in (("red", (0, 0, 255)), ("green", (0, 255, 0)),
                      ("blue", (255, 0, 0)), ("white", (90, 90, 90))):
        f = frame(*col)
        spi.xfer2(list(f)); spi.xfer2(list(f))      # twice - see docstring
        print(f"  {name}")
        t = time.time()
        while time.time() - t < 1.2:
            spi.xfer2(list(f))                      # refresh so it stays lit
            time.sleep(0.05)
    spi.xfer2(frame(0, 0, 0)); spi.xfer2(frame(0, 0, 0))
    spi.close()
    print(f"off. brightness capped at {LED_BRIGHT_CAP}/31 - full white on {n}")
    print("LEDs is 0.72 A, which the single cell cannot give you alongside a servo.")


def power():
    import subprocess
    for label, cmd in (("throttle flags", "vcgencmd get_throttled"),
                       ("core temp", "vcgencmd measure_temp"),
                       ("core volts", "vcgencmd measure_volts core")):
        r = subprocess.run(cmd.split(), capture_output=True, text=True)
        print(f"  {label:16} {(r.stdout or r.stderr).strip()}")
    print("\nthrottled=0x0 is clean. Bit 0 set = undervoltage RIGHT NOW,")
    print("bit 16 = it happened since boot. Either means the rail is sagging,")
    print("which on this build reads as random servo twitch or I2C dropouts.")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(0)
    {"i2c": lambda: i2c(), "cam": lambda: cam(),
     "servo": lambda: servo(a[1], a[2]), "sweep": lambda: sweep(a[1]),
     "led": lambda: led(a[1] if len(a) > 1 else LED_N),
     "power": lambda: power()}.get(a[0], lambda: print(__doc__))()
