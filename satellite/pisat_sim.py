#!/usr/bin/env python3
"""
pisat flight-software simulator — emits CCSDS Space Packets for the five custom
pisat apps that aren't covered by stock NASA cFS.

Packet layouts are taken verbatim from the pisat-gsw plugin's own tlm.txt files.
Header format per space_cyber_security/schema/parsers/WIRE_DECODER_HANDOFF.md:
  bytes 0-1  CCSDS_STREAMID  (BIG_ENDIAN)  type bit 12: 0=telemetry
  bytes 2-3  CCSDS_SEQUENCE  (BIG_ENDIAN)  flags<<14 | count
  bytes 4-5  CCSDS_LENGTH    (BIG_ENDIAN)  total_bytes - 7
  bytes 6-9  CCSDS_SECONDS   (BIG_ENDIAN)
  bytes 10-11 CCSDS_SUBSECS  (BIG_ENDIAN)
  bytes 12-15 CCSDS_SPARE
  bytes 16+  packet body     (LITTLE_ENDIAN)

Usage:
  python3 pisat_sim.py --host 172.18.0.9 --port 5013
  python3 pisat_sim.py --attack          # inject SPACECOP IDS alerts
"""
import argparse, math, random, socket, struct, time

# ---- APIDs (full 16-bit stream IDs, straight from the plugin) --------------
APID_EPS             = 0x09AA
APID_SYSMON          = 0x09CA
APID_STPYLD          = 0x09BA
APID_CAMERA          = 0x09DA
APID_SPACECOP_REPORT = 0x08FD
APID_SPACECOP_HK     = 0x08FE

SEQ = {}

def ccsds(stream_id: int, body: bytes) -> bytes:
    """Wrap a little-endian body in a 16-byte CCSDS telemetry header."""
    n = SEQ.get(stream_id, 0) & 0x3FFF
    SEQ[stream_id] = n + 1
    total = 16 + len(body)
    now = time.time()
    hdr = struct.pack(">HHHIH",
                      stream_id,
                      0xC000 | n,            # unsegmented
                      total - 7,             # CCSDS length
                      int(now),
                      int((now % 1) * 65536))
    return hdr + b"\x00" * 4 + body          # + 4-byte spare


class Pisat:
    """Single causal model: orbit -> illumination -> power -> thermal."""
    ORBIT_S = 5400.0        # 90 min

    def __init__(self, speedup=60.0):
        self.t0 = time.time()
        self.speedup = speedup
        self.cmd_count = 0
        self.cmd_err = 0
        self.images = 0
        self.batt_v = 3.95

    # --- orbital / illumination ------------------------------------------
    def phase(self):
        return ((time.time() - self.t0) * self.speedup % self.ORBIT_S) / self.ORBIT_S

    def sunlit(self):
        # ~62% of the orbit in sunlight
        return self.phase() < 0.62

    def sun_vec(self):
        a = 2 * math.pi * self.phase()
        return math.cos(a), math.sin(a), math.cos(a * 0.7)

    # --- EPS --------------------------------------------------------------
    def eps(self):
        lit = self.sunlit()
        sx, sy, sz = self.sun_vec()
        # 8 faces: R B Battery Blank T L F U  (Battery/Blank aren't panels)
        cos = {"R": max(0, sx), "B": max(0, -sy), "T": max(0, sz),
               "L": max(0, -sx), "F": max(0, sy), "U": max(0, -sz)}
        volts, amps = {}, {}
        for k, c in cos.items():
            if lit and c > 0.05:
                volts[k] = round(4.6 * c + random.uniform(-0.08, 0.08), 3)
                amps[k]  = round(148.0 * c + random.uniform(-4, 4), 2)
            else:
                volts[k] = round(random.uniform(0.0, 0.06), 3)
                amps[k]  = round(random.uniform(-0.4, 0.9), 2)   # < 2mA => idle
        gen = sum(amps[k] for k in cos)
        draw = 165.0
        self.batt_v += ((gen - draw) / 1e5) if lit else -0.00055
        self.batt_v = min(4.42, max(3.22, self.batt_v))
        batt_ma = round(gen - draw, 2)

        body = struct.pack("<3B16f12B",
            self.cmd_err & 0xFF, self.cmd_count & 0xFF, 0,
            volts["R"], volts["B"], round(self.batt_v, 3), 0.0,
            volts["T"], volts["L"], volts["F"], volts["U"],
            amps["R"], amps["B"], batt_ma, 0.0,
            amps["T"], amps["L"], amps["F"], amps["U"],
            1, 1, 1, 0, 1, 1, 1, 1,     # present flags
            7, 0, 0, 0)                  # SensorCount + spares
        return ccsds(APID_EPS, body)

    # --- SYSMON -----------------------------------------------------------
    def sysmon(self):
        up = int(time.time() - self.t0)
        body = struct.pack("<2BI2f4I",
            self.cmd_err & 0xFF, self.cmd_count & 0xFF,
            up,
            round(41.0 + 9 * math.sin(self.phase() * 2 * math.pi) + random.uniform(-1, 1), 2),
            round(random.uniform(11, 38), 2),
            8_192_000, random.randint(5_100_000, 6_400_000),
            458_000, random.randint(430_000, 437_000))
        return ccsds(APID_SYSMON, body)

    # --- STPYLD (BME280 + IMU + GPS) --------------------------------------
    def stpyld(self):
        body = struct.pack("<6B13f",
            self.cmd_err & 0xFF, self.cmd_count & 0xFF, 1, 1, 1, 1,
            round(21.5 + random.uniform(-1.5, 1.5), 2),      # temp C
            round(1006.0 + random.uniform(-4, 4), 2),        # hPa
            round(58.0 + random.uniform(-6, 6), 2),          # m
            round(41.0 + random.uniform(-3, 3), 2),          # %RH
            *[round(random.uniform(-2.5, 2.5), 4) for _ in range(3)],   # gyro
            round(random.uniform(-.07, .07), 4),
            round(random.uniform(-.07, .07), 4),
            round(1.0 + random.uniform(-.04, .04), 4),       # accel Z ~1g
            round(38.8977 + random.uniform(-.01, .01), 6),   # lat
            round(-77.0365 + random.uniform(-.01, .01), 6),  # lon
            round(415.0 + random.uniform(-8, 8), 2))         # alt km
        return ccsds(APID_STPYLD, body)

    # --- CAMERA -----------------------------------------------------------
    def camera(self, capture=False):
        if capture:
            self.images += 1
        body = struct.pack("<2BH3B128s2IB",
            self.cmd_err & 0xFF, self.cmd_count & 0xFF,
            self.images & 0xFFFF,
            1, 0, 0,
            f"/cf/img/IMG_{self.images:05d}.jpg".encode().ljust(128, b"\x00"),
            random.randint(180_000, 320_000),
            int(time.time()), 0)
        return ccsds(APID_CAMERA, body)

    # --- SPACECOP ---------------------------------------------------------
    def spacecop_hk(self):
        return ccsds(APID_SPACECOP_HK,
                     struct.pack("<2B", self.cmd_err & 0xFF, self.cmd_count & 0xFF))

    def spacecop_alert(self, msg):
        return ccsds(APID_SPACECOP_REPORT,
                     msg.encode()[:1023].ljust(1024, b"\x00"))


# SPARTA-mapped alerts, matching the attack in the space_cyber_security demo
ALERTS = [
    ("EX-0001", "REPLAY DETECTED: duplicate CCSDS sequence 0x{:04X} on CI_LAB uplink from 10.2.2.6"),
    ("IA-0008", "ROGUE SOURCE: command APID 0x1880 from 10.2.2.6 not in authorized command source list"),
    ("EX-0012", "ONBOARD VALUE MODIFIED: MM_POKE to protected address 0x4001F000 outside maintenance window"),
    ("DE-0001", "FAULT MGMT DISABLED: LC_SET_LC_STATE(DISABLED) received - limit checker suppressed"),
    ("EX-0006", "CRYPTO BYPASS: SDLS auth header absent on uplink frame, seq 0x{:04X}"),
    ("DE-0010", "AUDIT OVERFLOW: DS destination file table filled at 98%, oldest events rolling"),
]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="172.18.0.9", help="COSMOS operator container IP")
    p.add_argument("--port", type=int, default=5013)
    p.add_argument("--rate", type=float, default=1.0, help="housekeeping period (s)")
    p.add_argument("--speedup", type=float, default=60.0, help="orbit time compression")
    p.add_argument("--attack", action="store_true", help="inject SPACECOP IDS alerts")
    a = p.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sat = Pisat(speedup=a.speedup)
    dest = (a.host, a.port)
    print(f"[pisat-sim] -> {a.host}:{a.port}/udp  orbit x{a.speedup}"
          f"{'  ATTACK MODE' if a.attack else ''}", flush=True)

    i = 0
    while True:
        i += 1
        pkts = [sat.eps(), sat.sysmon(), sat.stpyld(), sat.spacecop_hk()]
        if i % 10 == 0:
            pkts.append(sat.camera(capture=True))
        if a.attack and i % 7 == 0:
            tech, tmpl = random.choice(ALERTS)
            msg = tmpl.format(random.randint(0, 0xFFFF)) if "{" in tmpl else tmpl
            pkts.append(sat.spacecop_alert(f"[{tech}] {msg}"))
            print(f"  !! IDS alert [{tech}] {msg[:70]}", flush=True)
        for pk in pkts:
            sock.sendto(pk, dest)
        if i % 20 == 0:
            print(f"  tx {i} cycles | batt {sat.batt_v:.2f}V | "
                  f"{'SUN' if sat.sunlit() else 'ECLIPSE'} | imgs {sat.images}", flush=True)
        time.sleep(a.rate)


if __name__ == "__main__":
    main()
