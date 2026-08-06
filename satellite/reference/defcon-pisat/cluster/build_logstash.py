"""
Generates the Logstash `translate` enum dictionaries from the grounded decode
table (decode_maps.py), so the dictionaries the shipper uses can never drift from
the source-of-truth (which is itself traced to the spacecop-demo flight software).

Writes JSON dictionaries into ../shipper/dictionaries/. Re-run after any change to
decode_maps.py:  python -m cluster.build_logstash
"""
import json
from pathlib import Path

from cluster.decode_maps import CS_CHECKSUM_STATE, HS_STATE, MM_LAST_ACTION, MM_MEM_TYPE

OUT = Path(__file__).resolve().parent.parent / "shipper" / "dictionaries"

# Logstash `translate` dictionaries are {source_string_value: mapped_string}. The
# decoded Zeek values arrive as strings ("1"), so keys are the stringified ints.
DICTS = {
    "cs_state.json": CS_CHECKSUM_STATE,       # CS ChecksumState (CHECKSUMSTATE/EEPROMCSSTATE/MEMORYCSSTATE)
    "hs_state.json": HS_STATE,                # HS State (CURRENTCPUHOGSTATE/…) — note: opposite polarity to CS
    "mm_lastaction.json": MM_LAST_ACTION,     # MM LastAction
    "mm_memtype.json": MM_MEM_TYPE,           # MM MemType
}


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    written = []
    for fname, m in DICTS.items():
        doc = {str(k): v for k, v in m.items()}
        (OUT / fname).write_text(json.dumps(doc, indent=2) + "\n")
        written.append((fname, len(doc)))
    return written


if __name__ == "__main__":
    for fname, n in build():
        print(f"wrote shipper/dictionaries/{fname}  ({n} entries)")
