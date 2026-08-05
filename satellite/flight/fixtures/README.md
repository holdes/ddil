# Reference packets from the wire

Supplied by Randi Tinney, 4 Aug 2026 — real packets captured by the updated
Zeek analyzer on `pisat`, decoded into Elastic.

**These are the ground truth for the flight agent.** Build a packet, compare it
byte-for-byte against `eps_hk_tlm.hex`. If it matches, COSMOS will decode it.
No amount of reading the spec proves that; this does.

## What they confirm

**Ports.** Commands arrive on `dst_port 5012`, telemetry on `dst_port 5013`.
`build-guide/06` originally had these reversed — corrected 4 Aug.

**Header layout**, verified against EPS_HK_TLM:

```
offset  size  field            endian   sample
0       2     CCSDS_STREAMID   BIG      0x09AA  (EPS)
2       2     CCSDS_SEQUENCE   BIG      0xC000  (flags 3<<14 | count)
4       2     CCSDS_LENGTH     BIG      85
6       4     CCSDS_SECONDS    BIG      300
10      2     CCSDS_SUBSECS    BIG      0
12      4     CCSDS_SPARE      LITTLE   0
16      ...   body             LITTLE   floats, uint8s
```

16 bytes of header, then the body little-endian. `cd cc 6c 40` at offset 19
decodes as a little-endian float = 3.7, matching `RSolarPanelV`.

**APID is the low 11 bits of the stream ID**: 0x09AA & 0x07FF = 426, which is
what Zeek reports as `apid`.

**The Zeek analyzer now decommutates everything.** Every field appears under
`parameters.*`, not just the header. That is why the proposed OpenC3
microservices for decommutated telemetry are not needed — the values are
already on the wire and already in Elastic.
