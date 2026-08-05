#!/usr/bin/env python3
"""
ccsds.py - build and parse the packets this demo actually puts on the wire.

Ground truth is `fixtures/eps_hk_tlm.hex`, a real 95-byte EPS housekeeping
packet captured off the link. `selftest()` rebuilds that packet from scratch and
compares byte-for-byte; if this module and the vehicle ever disagree, the test
fails rather than the demo.

Field order comes from the COSMOS definition
(`gsw/openc3-cosmos-cfs/targets/EPS/cmd_tlm/tlm.txt`), not from the C struct.
The struct declares `float voltage[8]` with no hint of which slot is which
panel; COSMOS names them, and COSMOS is what decodes the packet at the far end.

    R, B, Battery, Blank, T, L, F, U

Run:  python3 ccsds.py        -> runs the self-test
"""
import os
import re
import struct
import time

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(HERE, "fixtures")

# ---------------------------------------------------------------- message IDs
# From spacecop-demo apps/*/platform_inc/*_msgids.h. Telemetry 0x09xx,
# commands 0x19xx - bit 12 of the stream ID is the CCSDS packet-type flag.
EPS_HK_TLM     = 0x09AA
SYSMON_HK_TLM  = 0x09CA
STPYLD_HK_TLM  = 0x09BA
CAMERA_HK_TLM  = 0x09DA
SPACECOP_REPORT_TLM = 0x08FD

EPS_CMD        = 0x19AA
SYSMON_CMD     = 0x19CA
STPYLD_CMD     = 0x19BA
CAMERA_CMD     = 0x19DA

HDR = 16                      # primary (6) + telemetry secondary (10)
PANELS = ("R", "B", "Battery", "Blank", "T", "L", "F", "U")

# ------------------------------------------------------------------- lengths
#
# The CCSDS standard says the length field is (octets in the packet data field)
# minus one, i.e. `total - 7`. The commands on this link follow that: the
# captured CFDP command is 136 bytes with LENGTH 129.
#
# EPS telemetry does not. The captured packet is 95 bytes with LENGTH 85, which
# is `total - 10` - three short of the standard, and three is exactly
# sizeof(spare[3]), the trailing field of EPS_Hk_tlm_t. The flight software
# appears to compute the length without those bytes but transmit them anyway.
#
# We reproduce that rather than "correcting" it. The job of this prop is to be
# indistinguishable from the pisat to the same Zeek analyzer and the same COSMOS
# definitions; a packet that is standards-correct but different from the real
# vehicle is a packet that decodes differently, which is the opposite of what we
# want. If the flight software is ever fixed, change TLM_LENGTH_BIAS to 7.
CMD_LENGTH_BIAS = 7
TLM_LENGTH_BIAS = 10


def is_command(msg_id):
    """CCSDS packet type: bit 12 of the stream ID. 1 = command, 0 = telemetry."""
    return bool((msg_id >> 12) & 1)


def build(msg_id, payload, seq_count=0, seconds=None, subsecs=0,
          seq_flags=0b11):
    """
    Assemble a packet. `payload` is everything after the 16-byte header, already
    little-endian.

    Header is big-endian through the subseconds field and little-endian from
    CCSDS_SPARE onward. Getting that boundary wrong produces a packet that
    decodes into plausible-looking garbage, which is the failure mode worth
    fearing here.
    """
    if seconds is None:
        seconds = int(time.time()) & 0xFFFFFFFF
    total = HDR + len(payload)
    bias = CMD_LENGTH_BIAS if is_command(msg_id) else TLM_LENGTH_BIAS
    length = total - bias
    if length < 0:
        raise ValueError(f"payload too short for a {total}-byte packet")

    seq = ((seq_flags & 0b11) << 14) | (seq_count & 0x3FFF)
    head = struct.pack(">HHH", msg_id & 0xFFFF, seq, length)
    head += struct.pack(">IH", seconds & 0xFFFFFFFF, subsecs & 0xFFFF)
    head += struct.pack("<I", 0)            # CCSDS_SPARE - little-endian
    return head + payload


def parse(pkt):
    """Split a packet into its header fields and raw body. Never raises on
    short input - callers get `valid=False` and decide, because malformed
    packets arrive from the network and must not take the vehicle down."""
    out = {"valid": False, "error": None, "raw_len": len(pkt)}
    if len(pkt) < 6:
        out["error"] = "shorter than a CCSDS primary header"
        return out
    sid, seq, length = struct.unpack_from(">HHH", pkt, 0)
    out.update(
        stream_id=sid, apid=sid & 0x07FF, is_command=is_command(sid),
        sequence_flags=(seq >> 14) & 0b11, packet_sequence=seq & 0x3FFF,
        data_length=length,
    )
    if len(pkt) < HDR:
        out["error"] = "shorter than a full telemetry header"
        return out
    secs, subs = struct.unpack_from(">IH", pkt, 6)
    spare, = struct.unpack_from("<I", pkt, 12)
    out.update(seconds=secs, subsecs=subs, spare=spare, body=pkt[HDR:])

    bias = CMD_LENGTH_BIAS if out["is_command"] else TLM_LENGTH_BIAS
    expect = len(pkt) - bias
    if length != expect:
        out["error"] = f"length field {length}, expected {expect}"
        return out
    out["valid"] = True
    return out


# ------------------------------------------------------------------- EPS body

def eps_body(volts, milliamps, present, command_count=0, command_errors=0,
             error_count=0, sensor_count=8, spare=(0, 0, 0)):
    """
    EPS_Hk_tlm_t after the header.

    volts / milliamps / present are 8-element sequences in the COSMOS order
    (R, B, Battery, Blank, T, L, F, U) - see PANELS.
    """
    for name, seq in (("volts", volts), ("milliamps", milliamps),
                      ("present", present)):
        if len(seq) != 8:
            raise ValueError(f"{name} must have 8 entries, got {len(seq)}")
    return (bytes((command_errors & 0xFF, command_count & 0xFF,
                   error_count & 0xFF))
            + struct.pack("<8f", *volts)
            + struct.pack("<8f", *milliamps)
            + bytes(p & 0xFF for p in present)
            + bytes((sensor_count & 0xFF,))
            + bytes(s & 0xFF for s in spare))


def eps_packet(volts, milliamps, present, seq_count=0, seconds=None, **kw):
    return build(EPS_HK_TLM, eps_body(volts, milliamps, present, **kw),
                 seq_count=seq_count, seconds=seconds)


def decode_eps(pkt):
    """Named fields from an EPS packet, in the COSMOS naming."""
    p = parse(pkt)
    if not p.get("body") or len(p["body"]) < 76:
        p["error"] = p["error"] or "body too short for EPS_Hk_tlm_t"
        return p
    b = p["body"]
    v = struct.unpack_from("<8f", b, 3)
    ma = struct.unpack_from("<8f", b, 35)
    pres = b[67:75]
    p["fields"] = {"CommandErrorCount": b[0], "CommandCount": b[1],
                   "ErrorCount": b[2], "SensorCount": b[75]}
    for i, n in enumerate(PANELS):
        tag = n if n in ("Battery", "Blank") else f"{n}SolarPanel"
        p["fields"][f"{tag}V"] = round(v[i], 6)
        p["fields"][f"{tag}Ma"] = round(ma[i], 6)
        p["fields"][f"{tag}P"] = pres[i]
    return p


# ------------------------------------------------------------------- fixtures

def load_fixture(name):
    with open(os.path.join(FIXTURES, name)) as f:
        return bytes.fromhex(re.sub(r"[^0-9a-fA-F]", "", f.read()))


def selftest():
    ok = True

    def check(label, cond, detail=""):
        nonlocal ok
        print(f"  {'PASS' if cond else 'FAIL'}  {label}{'  ' + detail if detail else ''}")
        ok = ok and cond

    print("EPS_HK_TLM - rebuild the captured packet from scratch")
    ref = load_fixture("eps_hk_tlm.hex")

    # the values the real packet carried, in COSMOS order
    volts = [3.7, 3.4, 4.1, 0.0, 0.0, 0.0, 0.0, 0.0]
    ma    = [0.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    pres  = [95, 0, 0, 0, 0, 0, 0, 0]
    mine = eps_packet(volts, ma, pres, seq_count=0, seconds=300,
                      command_count=5, sensor_count=8)

    check("length matches", len(mine) == len(ref), f"{len(mine)} vs {len(ref)}")
    if len(mine) == len(ref):
        diff = [i for i in range(len(ref)) if mine[i] != ref[i]]
        check("byte-for-byte identical", not diff,
              "" if not diff else f"differs at {diff[:8]}")
    else:
        ok = False

    print("\nround trip")
    d = decode_eps(mine)
    check("parses as valid", d["valid"], d.get("error") or "")
    f = d.get("fields", {})
    check("RSolarPanelV == 3.7", f.get("RSolarPanelV") == 3.7)
    check("BatteryV == 4.1", f.get("BatteryV") == 4.1)
    check("CommandCount == 5", f.get("CommandCount") == 5)

    print("\nthe reference packet itself")
    r = parse(ref)
    check("fixture parses as valid", r["valid"], r.get("error") or "")
    check("APID is EPS", r.get("stream_id") == EPS_HK_TLM)
    check("classified as telemetry", r.get("is_command") is False)

    print("\nmalformed input is survivable")
    for bad, label in ((b"", "empty"), (b"\x09", "one byte"),
                       (ref[:10], "truncated header"),
                       (ref[:-4], "truncated body")):
        p = parse(bad)
        check(f"{label} -> rejected, no exception", p["valid"] is False)

    print("\ncommand fixture")
    cmd = load_fixture("cfdp_download_cmd.hex")
    c = parse(cmd)
    check("recognised as a command", c.get("is_command") is True)
    # 27 bytes on disk against a 136-byte packet on the wire: this fixture was
    # truncated when it was saved out of the mail. Kept as a header sample only.
    print(f"  NOTE  fixture holds {len(cmd)} bytes; the real packet is 136 - "
          f"header-only sample, body is missing")

    print("\n" + ("ALL PASS" if ok else "FAILURES ABOVE"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(selftest())
