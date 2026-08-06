# Vendored reference — copies, not sources

The kit has no access to the upstream repos. These are the parts of them that
work here actually depends on, copied so the kit is self-sufficient offline.

**These are copies. Do not edit them, and do not treat them as authoritative if
you can reach the real thing.** They are a snapshot taken 5 Aug 2026.

| Path | From | Why it is here |
|---|---|---|
| `cosmos-targets/` | `the-aerospace-corporation/spacecop-demo` → `gsw/openc3-cosmos-cfs/targets/` | The command and telemetry definitions. **This is the authoritative wire layout for every packet** — field order, types, endianness. `ccsds.py` was built from `EPS/cmd_tlm/tlm.txt`; the same files define SYSMON, CAMERA, STPYLD, SPACECOP and the standard cFS apps. |
| `plugin.txt` | same repo, `gsw/openc3-cosmos-cfs/plugin.txt` | The COSMOS plugin. Needed to make our `DEMOSAT_*` copy — every target name and `target_ip` is already a `VARIABLE`; only `INTERFACE PISAT_INT` is hardcoded and needs to become one. |
| `defcon-pisat/` | `Villegas12/space_cyber_security` → `demodocs/defcon-pisat/` | **The built integration, as of 6 Aug.** Cluster config, 27 rules, 21 ML jobs, the Filebeat/Logstash shipper with its enum dictionaries, and `diagram.md` — the Elastic side's own end-to-end data-flow doc. **This supersedes our earlier analysis of which detections fire.** |
| `ccsds_full_analyzer.zeek` | same repo, `gsw/` | The Zeek CCSDS analyzer. |

## ⚠️ The analyzer copy is stale

`ccsds_full_analyzer.zeek` decodes **headers only**. The version actually running
on the ground station also decodes **parameters** — that fix was never pushed
upstream, so this copy does not have it and neither does GitHub.

**Do not derive field lists from it.** The live output carries flattened
`parameters.*` keys. Real samples are in the "PiSat logs" mail thread, and
`HANDOFF.md` §3 has the detail. The file is here for the framing and log-stream
structure, nothing more.

## Licence

The COSMOS plugin material is Aerospace Corporation, LGPL-3.0-or-later — see
`COSMOS-PLUGIN-LICENSE.md`. The SPARTA rules are Apache-2.0, `author: ["Elastic"]`.
`spacecop-demo` is public; `space_cyber_security` is private and shared between
colleagues. Nothing here is redistributed under different terms.

## Getting the real thing

If the machine has internet, prefer the upstream over these copies:

```bash
git clone https://github.com/the-aerospace-corporation/spacecop-demo
git clone https://github.com/Villegas12/space_cyber_security
```

`rtinney1/pisat-gsw` is a byte-identical copy of `spacecop-demo/gsw/` — 180 files,
`diff -rq` clean. There is no reason to clone it.
