"""
Grounded decode table for the pisat decoded-Zeek telemetry feed.

Blake's updated Zeek CCSDS analyzer decodes the full packet, emitting flat raw
string values as `parameters.<NAME>` (e.g. `parameters.CHECKSUMSTATE: "1"`). The
project's analytics read the NORMALIZED layer (`cs.checksumState == "DISABLED"`),
so this module maps the raw parameters to the normalized wire-native fields and
decodes the integer enums to their labels.

EVERY enum value is grounded in the actual flight-software source
(github.com/the-aerospace-corporation/spacecop-demo), NOT cFS conventions — which
matters: it corrected an earlier assumption where MM LastAction 5 was wrongly
mapped to POKE (5 is DUMP_TO_FILE; only 2 is POKE).

Sources:
  CS  CS_ChecksumState  — apps/cs/config/default_cs_extern_typedefs.h
  HS  HS_State          — apps/hs  (#define HS_State_DISABLED 0 / HS_State_ENABLED 1)
  MM  LastAction/MemType— apps/mm/eds/mm.xml
  CAMERA/STPYLD flags   — Blake (Aerospace): all status ints are 1=true / 0=false
  SPACECOP IDS_MSG      — free-text string, no enum
"""

# ── source-grounded enum maps (int -> label) ─────────────────────────────────
CS_CHECKSUM_STATE = {0: "EMPTY", 1: "ENABLED", 2: "DISABLED", 3: "UNDEFINED"}
HS_STATE          = {0: "DISABLED", 1: "ENABLED"}   # NOTE: opposite polarity to CS
MM_LAST_ACTION = {
    0: "NOACTION", 1: "PEEK", 2: "POKE", 3: "LOAD_FROM_FILE", 4: "LOAD_WID",
    5: "DUMP_TO_FILE", 6: "DUMP_INEVENT", 7: "FILL", 8: "SYM_LOOKUP",
    9: "SYMTBL_SAVE", 10: "EEPROMWRITE_ENA", 11: "EEPROMWRITE_DIS",
    12: "NOOP", 13: "RESET",
}
MM_MEM_TYPE = {0: "NOMEMTYPE", 1: "RAM", 2: "EEPROM", 3: "MEM8", 4: "MEM16", 5: "MEM32"}


def _b(v):
    """Payload status flag: grounded boolean (1=true / 0=false)."""
    try:
        return bool(int(v))
    except (TypeError, ValueError):
        return None


def _enum(m, v):
    try:
        return m.get(int(v))
    except (TypeError, ValueError):
        return None


def _p(raw, name):
    """Read a decoded parameter from the flat `parameters.<NAME>` Zeek shape."""
    return raw.get(f"parameters.{name}")


# ── per-packet normalization → wire-native record the core chain/rules read ───
# Each entry: the packet's target/name → the normalized record it produces. Only
# packets our analytics consume are mapped to a logs partition; numeric-gauge-only
# packets (EPS/CAMERA/STPYLD) return dataset "metrics" (parked — OTEL lane, no
# logs home by design).

def normalize(raw):
    """Map one raw decoded-Zeek telemetry doc (flat parameters.*) to a normalized
    wire-native record with event.dataset set, or a {'dataset':'metrics'} marker
    for numeric-gauge packets that belong in the OTEL lane (not shipped as logs).
    Returns None if the packet is unrecognized."""
    tgt = raw.get("target")
    pkt = raw.get("packet_name")

    if tgt == "CS" and pkt == "CS_HKPACKET":
        return {"event": {"dataset": "space.memory"}, "fswApp": "CS", "subtype": "CS_HK",
                "cs": {"checksumState": _enum(CS_CHECKSUM_STATE, _p(raw, "CHECKSUMSTATE")),
                       "eepromState":   _enum(CS_CHECKSUM_STATE, _p(raw, "EEPROMCSSTATE")),
                       "memoryState":   _enum(CS_CHECKSUM_STATE, _p(raw, "MEMORYCSSTATE"))}}

    if tgt == "MM" and pkt == "MM_HKPACKET":
        action = _enum(MM_LAST_ACTION, _p(raw, "LASTACTION"))
        return {"event": {"dataset": "space.memory"}, "fswApp": "MM",
                # subtype carries the action so the core memory rule (subtype==MM_POKE) fires
                "subtype": f"MM_{action}" if action else "MM_HK",
                "mm": {"lastAction": action,
                       "memType": _enum(MM_MEM_TYPE, _p(raw, "MEMTYPE")),
                       "address": _int(_p(raw, "ADDRESS")),
                       "dataValue": _int(_p(raw, "DATAVALUE"))}}

    if tgt == "HS" and pkt == "HS_HKPACKET":
        return {"event": {"dataset": "space.health"}, "fswApp": "HS", "subtype": "HS_HK",
                "hs": {"cpuHogState":  _enum(HS_STATE, _p(raw, "CURRENTCPUHOGSTATE")),
                       "appMonState":  _enum(HS_STATE, _p(raw, "CURRENTAPPMONSTATE")),
                       "eventMonState": _enum(HS_STATE, _p(raw, "CURRENTEVENTMONSTATE")),
                       "statusFlags":  _int(_p(raw, "STATUSFLAGS"))}}

    if tgt == "SPACECOP" and pkt == "SPACECOP_REPORT_TLM":
        return {"event": {"dataset": "space.events"}, "target_name": "SPACECOP",
                "packet_name": "SPACECOP_REPORT_TLM", "PACKETID_EVENTTYPE": 4,
                "message": _p(raw, "IDS_MSG")}

    # EPS / CAMERA / STPYLD and other HK packets: numeric gauges (+ boolean flags).
    # No logs partition by design — they belong in the OTEL metrics lane. Parked.
    if pkt and pkt.endswith("_HK_TLM"):
        return {"event": {"dataset": "metrics"}}   # marker: park (OTEL lane, deferred)

    return None


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    # self-test: the states our effect rules key on, decoded from raw ints
    cs = normalize({"target": "CS", "packet_name": "CS_HKPACKET",
                    "parameters.CHECKSUMSTATE": "2", "parameters.EEPROMCSSTATE": "1",
                    "parameters.MEMORYCSSTATE": "1"})
    assert cs["cs"]["checksumState"] == "DISABLED", cs
    hs = normalize({"target": "HS", "packet_name": "HS_HKPACKET",
                    "parameters.CURRENTCPUHOGSTATE": "1"})
    assert hs["hs"]["cpuHogState"] == "ENABLED", hs
    mm = normalize({"target": "MM", "packet_name": "MM_HKPACKET",
                    "parameters.LASTACTION": "2", "parameters.MEMTYPE": "1",
                    "parameters.ADDRESS": "6280"})
    assert mm["subtype"] == "MM_POKE" and mm["mm"]["memType"] == "RAM", mm
    # the corrected value: 5 is DUMP_TO_FILE, NOT POKE
    mm5 = normalize({"target": "MM", "packet_name": "MM_HKPACKET", "parameters.LASTACTION": "5"})
    assert mm5["mm"]["lastAction"] == "DUMP_TO_FILE", mm5
    sc = normalize({"target": "SPACECOP", "packet_name": "SPACECOP_REPORT_TLM",
                    "parameters.IDS_MSG": "IDS ALERT: unauthorized MM_POKE"})
    assert sc["event"]["dataset"] == "space.events" and "ALERT" in sc["message"], sc
    eps = normalize({"target": "EPS", "packet_name": "EPS_HK_TLM", "parameters.BatteryV": "4.1"})
    assert eps["event"]["dataset"] == "metrics", eps
    print("decode_maps self-test: PASS (CS/HS/MM/SPACECOP grounded; MM 5=DUMP_TO_FILE corrected)")
