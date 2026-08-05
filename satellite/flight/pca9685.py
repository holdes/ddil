#!/usr/bin/env python3
"""
pca9685.py - minimal PCA9685 servo driver on smbus2.

Deliberately NOT adafruit-circuitpython-pca9685: that pulls in Blinka, which on
Debian Trixie means pip with --break-system-packages and a dependency tree we
would then have to reproduce on the flight card. smbus2 is already installed and
the chip is simple enough that this is ~60 lines.

Registers (from the PCA9685 datasheet):
    0x00  MODE1        SLEEP is bit 4, AI (auto-increment) is bit 5
    0xFE  PRESCALE     only writable while SLEEP is set
    0x06  LED0_ON_L    four bytes per channel, 4 bytes apart

Prescale for a target frequency, with the internal 25 MHz oscillator:
    prescale = round(25e6 / (4096 * freq)) - 1
At 50 Hz that is 121, giving a 20 ms period - what a hobby servo expects.
"""
import math
import time

from smbus2 import SMBus

MODE1, PRESCALE, LED0_ON_L = 0x00, 0xFE, 0x06
OSC = 25_000_000


class PCA9685:
    def __init__(self, bus=3, addr=0x40, freq=50.0):   # bus 3 = software I2C
        self.bus, self.addr = SMBus(bus), addr
        self.freq = freq
        self.bus.write_byte_data(self.addr, MODE1, 0x00)
        time.sleep(0.01)
        self.set_freq(freq)

    def set_freq(self, hz):
        pre = int(round(OSC / (4096.0 * hz)) - 1)
        old = self.bus.read_byte_data(self.addr, MODE1)
        self.bus.write_byte_data(self.addr, MODE1, (old & 0x7F) | 0x10)  # sleep
        self.bus.write_byte_data(self.addr, PRESCALE, pre)
        self.bus.write_byte_data(self.addr, MODE1, old)
        time.sleep(0.005)
        self.bus.write_byte_data(self.addr, MODE1, old | 0xA1)           # AI on
        self.freq = hz

    def set_pwm(self, ch, on, off):
        self.bus.write_i2c_block_data(self.addr, LED0_ON_L + 4 * ch,
                                      [on & 0xFF, on >> 8, off & 0xFF, off >> 8])

    def pulse_us(self, ch, us):
        """Set a channel's pulse width in microseconds."""
        period = 1_000_000.0 / self.freq
        self.set_pwm(ch, 0, int(round(4096.0 * us / period)))

    def angle(self, ch, deg, lo_us=500, hi_us=2500):
        """-90..+90 degrees. Limits are the MG90S's usable range, not a spec."""
        deg = max(-90.0, min(90.0, float(deg)))
        self.pulse_us(ch, lo_us + (deg + 90.0) / 180.0 * (hi_us - lo_us))

    def glide(self, ch, a0, a1, dur=1.1, hz=50):
        """Ease from a0 to a1 instead of jumping.

        `angle()` commands the target and the servo slews there at whatever
        speed it can - abrupt to watch, and a current spike from a standstill.
        Stepping through the move with a raised-cosine profile means it
        accelerates and decelerates, which looks like motion rather than
        teleportation AND lowers peak draw, because the servo is never asked
        for full speed from rest.

        dur seconds, hz updates per second. 50 Hz matches the frame rate, so
        every step lands on a fresh pulse.
        """
        n = max(2, int(dur * hz))
        for i in range(n + 1):
            t = i / n
            e = 0.5 - 0.5 * math.cos(math.pi * t)      # ease in AND out
            self.angle(ch, a0 + (a1 - a0) * e)
            time.sleep(dur / n)
        return a1

    def off(self, ch):
        """Stop driving - the servo goes limp instead of buzzing."""
        self.set_pwm(ch, 0, 4096)

    def all_off(self):
        for c in range(16):
            self.off(c)


if __name__ == "__main__":
    import sys
    a = sys.argv[1:]
    p = PCA9685()
    print(f"  PCA9685 at 0x40, {p.freq:.0f} Hz")
    if len(a) >= 2:
        ch, deg = int(a[0]), float(a[1])
        print(f"  channel {ch} -> {deg:+.0f} deg")
        p.angle(ch, deg); time.sleep(0.6); p.off(ch)
        print("  released")
    else:
        print("  usage: python3 pca9685.py <channel> <angle -90..90>")
