"""
DEFCON demo-data seeding — builds the attendee-session baseline + attack + telemetry
effects programmatically (telemetry decoded through decode_maps, mirroring the live
shipper) and ingests them via the same create-op path. Teardown removes exactly this
data by its pipeline_source (the DEFCON lanes below), which survives the chain in
_source; core data never uses these lanes.
"""
from datetime import datetime, timedelta, timezone

from cluster import decode_maps

# pipeline_source values the DEFCON lanes stamp — the same the live shipper's Filebeat
# stamps. Teardown deletes exactly these from the shared partitions.
_DEFCON_LANES = {"zeek-ccsds", "pisat-portal"}


def _now_iso(offset_s=0):
    t = datetime.now(timezone.utc) + timedelta(seconds=offset_s)
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}Z"


def _bulk(es, index, docs):
    ops = []
    for d in docs:
        d.setdefault("labels", {})["defcon"] = "pisat"
        ops += [{"create": {"_index": index}}, d]
    if not ops:
        return 0
    r = es.bulk(operations=ops)
    return sum(1 for it in r.body["items"] if it["create"].get("status") in (200, 201))


# Routine operator commands — the small benign set a mission actually repeats
# (housekeeping requests, free-space checks, integrity-baseline reports; cf. the
# pisat day_in_the_life procedure). A TIGHT normal vocabulary is what lets the ML
# `rare` detector flag the insider's out-of-pattern command. (target, command, fc)
ROUTINE_COMMANDS = [
    ("CAMERA", "CAMERA_REQUEST_HK_CC", 4),
    ("EPS", "EPS_REQUEST_HK_CC", 4),
    ("SYSMON", "SYSMON_REQUEST_HK_CC", 4),
    ("SPACECOP", "SPACECOP_REQUEST_HK_CC", 2),
    ("FM", "FM_GET_FREE_SPACE_CC", 2),
    ("CS", "CS_REPORT_BASELINE_OS_CC", 6),
    ("HK", "HK_SEND_COMBINED_PKT_CC", 3),
]
# Conference attendees — each logs into the portal; ONE operator at a time.
ATTENDEES = ["alice.k", "bob.r", "carol.m", "dave.p", "erin.s"]
ATTACKER = "mallory.x"          # the attendee whose session turns malicious
PORTAL_HOST = "192.168.4.5"     # the access portal relays every attendee command from here
CI_HOST = "192.168.4.10"        # cFS Command Ingest (destination)
ROGUE_IP = "192.168.4.99"       # an injection host bypassing the portal (unauthorized source)
# The portal auth log is IT/identity data — it lives in its OWN index (like conn.log ->
# the Zeek integration), NOT the space-segment wired stream (which drops unrouted docs).
PORTAL_INDEX = "logs-pisat-portal"
TELEM_INDEX = "logs-pisat-telemetry"   # all numeric telemetry (abnormal-telemetry ML store)


def _login(off, user):
    """A portal LOGIN event — the attribution source (ECS authentication shape). The
    shipper maps email->user.name, ip->source.ip; seeded already-normalized here."""
    return {"@timestamp": _now_iso(off), "pipeline_source": "pisat-portal",
            "event": {"module": "pisat-portal", "dataset": "portal.auth", "kind": "event",
                      "category": ["authentication"], "type": ["start"], "action": "login"},
            "service": {"name": "pisat-portal"}, "user": {"name": user}, "source": {"ip": PORTAL_HOST}}


def _cmd(off, tgt, cmd, fc, apid, user=None, ip=PORTAL_HOST):
    """A command as captured on the wire (source.ip = the portal host for legitimate
    commands, a rogue host for injection). `user.name` on a seeded command is DEMO data
    standing in for an already-attributed operator so the attributed rules fire in the
    demo; on LIVE data commands carry NO user.name — the AI agent attributes them at query
    time from the portal registration log (logs-pisat-portal)."""
    d = {"@timestamp": _now_iso(off), "pipeline_source": "zeek-ccsds",
         "event": {"module": "cosmos", "dataset": "space.command", "original": f"{apid:04x}c0000005"},
         "source": {"ip": ip, "port": 40000}, "destination": {"ip": CI_HOST, "port": 5012},
         "target_name": tgt, "packet_name": cmd, "command": {"name": cmd, "opcode": fc},
         "CCSDS_STREAMID": apid, "CCSDS_FC": fc, "primaryHeader": {"apid": apid & 0x07FF}}
    if user:
        d["user"] = {"name": user}
    return d


# Baseline window for the behavioral ML: 5 days of normal operations. A dense, tight
# routine vocabulary over many 15-minute buckets is what lets the `rare` detector score
# an out-of-vocabulary dangerous command as anomalous (the model needs a confident
# "normal" to deviate from — see the sparse-data score ceiling in the rule-authoring skill).
BASELINE_SPAN = 5 * 24 * 3600     # 5 days
BASELINE_N = 1800                 # ~15 routine commands/hour across the 5 days


def seed_baseline(es):
    """One operator at a time over 5 days: each attendee logs into the portal, then issues
    the small ROUTINE command set during their session. Commands are wire-captured
    (source.ip = the portal host) and attributed to the active attendee — mirroring the
    live portal-session lookup. The tight per-user vocabulary, spread densely over the
    5-day window, is the behavioral-ML baseline the `rare` detector learns as normal."""
    span, n = BASELINE_SPAN, BASELINE_N
    step, seg = span / n, n // len(ATTENDEES)
    logins = [_login(-span + a_i * (span // len(ATTENDEES)), user) for a_i, user in enumerate(ATTENDEES)]
    docs = []
    for i in range(n):
        off = -span + int(i * step)
        user = ATTENDEES[min(i // seg, len(ATTENDEES) - 1)]   # serialized: one at a time
        tgt, cmd, fc = ROUTINE_COMMANDS[i % len(ROUTINE_COMMANDS)]
        docs.append(_cmd(off, tgt, cmd, fc, 0x1800 + (i % 50), user=user))
    _bulk(es, PORTAL_INDEX, logins)          # portal auth -> its own index
    return _bulk(es, "logs.ecs", docs)       # commands -> the wired stream


HAZARDOUS_ATTACK = [("MM", "MM_POKE", 2, 0x1888),
                    ("MM", "MM_ENABLE_EEPROM_WRITE", 11, 0x1888),
                    ("CS", "CS_DISABLE_ALL_CS", 5, 0x18A0)]


def seed_attack(es):
    """The attacker's session, then the on-board effects:
      1. mallory.x logs into her authorized session and issues hazardous commands as a
         burst — carrying a seeded user.name (demo stand-in for agent attribution) so the
         attributed-hazardous + flooding + ML rules fire.
      2. An INJECTION from a rogue host that bypasses the portal (unauthorized source.ip,
         no session) — the hazardous ones are still caught on the wire.
    Plus the on-board effects + the SPACECOP IDS alert (via _seed_telemetry).
    """
    _bulk(es, PORTAL_INDEX, [_login(-1520, ATTACKER)])   # mallory's portal login
    docs = []
    # 1. portal attack — hazardous commands attributed to mallory; also a burst (flooding)
    for i, (tgt, cmd, fc, apid) in enumerate(HAZARDOUS_ATTACK * 4):
        docs.append(_cmd(-1500 + i * 2, tgt, cmd, fc, apid, user=ATTACKER))
    # 2. injection — rogue host bypassing the portal (no session -> no user.name)
    for i, (tgt, cmd, fc, apid) in enumerate([
            ("CFE", "CFE_TIME_SET_TIME", 8, 0x1805),
            ("CS", "CS_ENABLE_EEPROM", 6, 0x18A0)]):
        docs.append(_cmd(-1400 + i, tgt, cmd, fc, apid, user=None, ip=ROGUE_IP))
    return _bulk(es, "logs.ecs", docs) + _seed_telemetry(es)


def _tlm(off, target, packet, **params):
    """Build a RAW decoded-Zeek telemetry doc (flat `parameters.*` string values,
    exactly as Blake's feed emits) and normalize it via decode_maps — the SAME
    transform the Logstash pipeline applies. So the seed faithfully mirrors live data
    AND exercises the grounded (source-traced) decode table. Returns None for
    gauge/parked packets (no logs home)."""
    raw = {"target": target, "packet_name": packet}
    for k, v in params.items():
        raw[f"parameters.{k}"] = str(v)
    rec = decode_maps.normalize(raw)
    if rec is None or rec.get("event", {}).get("dataset") == "metrics":
        return None
    rec["@timestamp"] = _now_iso(off)
    rec["pipeline_source"] = "zeek-ccsds"
    rec.setdefault("event", {})["module"] = "cosmos"
    return rec


def _seed_telemetry(es):
    """Telemetry effects, emitted as RAW integer states and decoded through
    decode_maps (mirroring the live Logstash path): nominal baseline, then after the
    attack burst — CS integrity disabled (CHECKSUMSTATE 2=DISABLED), an MM POKE
    (LASTACTION 2=POKE), CPU hog on (CURRENTCPUHOGSTATE 1=ENABLED), SPACECOP IDS."""
    docs = []
    for i in range(60):
        off = -6 * 3600 + i * 300
        docs.append(_tlm(off, "CS", "CS_HKPACKET", CHECKSUMSTATE=1, EEPROMCSSTATE=1, MEMORYCSSTATE=1))
        docs.append(_tlm(off, "HS", "HS_HKPACKET", CURRENTCPUHOGSTATE=0, STATUSFLAGS=0))
    docs += [
        _tlm(-1350, "CS", "CS_HKPACKET", CHECKSUMSTATE=2, EEPROMCSSTATE=2, MEMORYCSSTATE=1),      # integrity off
        _tlm(-1350, "MM", "MM_HKPACKET", LASTACTION=2, MEMTYPE=1, ADDRESS=0x1888, DATAVALUE=0),   # POKE
        _tlm(-1348, "HS", "HS_HKPACKET", CURRENTCPUHOGSTATE=1, STATUSFLAGS=4),                    # CPU hog
        _tlm(-1345, "SPACECOP", "SPACECOP_REPORT_TLM",
             IDS_MSG="IDS ALERT: unauthorized MM_POKE outside maintenance window"),
    ]
    return _bulk(es, "logs.ecs", [d for d in docs if d])


# ── abnormal-telemetry seed (logs-pisat-telemetry) ───────────────────────────
# Real packet/field names (spacecop-demo cosmos_definitions.json); values are
# representative. Each entry: (target, packet) -> {field: (nominal, anomalous)}. These are
# exactly the metrics the telemetry_ml jobs model.
_TLM_METRICS = {
    ("EPS", "EPS_HK_TLM"): {"BatteryV": (4.1, 3.2), "BatteryMa": (2.0, 520.0),
                            "ErrorCount": (0, 5), "CommandCount": (5, 5), "RSolarPanelV": (3.7, 3.7)},
    ("SYSMON", "SYSMON_HK_TLM"): {"CPULoadPercent": (22, 96), "CPUTempC": (46, 84),
                                  "FreeMemoryKB": (410000, 18000), "DiskFreeMB": (8200, 180)},
    ("HS", "HS_HKPACKET"): {"RESETSPERFORMED": (0, 8), "UTILCPUAVG": (31, 93),
                            "UTILCPUPEAK": (55, 99), "MAXRESETS": (10, 10)},
    ("CFE_ES", "CFE_ES_HKPACKET"): {"PROCESSORRESETS": (0, 6), "HEAPBYTESFREE": (520000, 9000),
                                    "SYSLOGBYTESUSED": (2000, 50000)},
    ("CS", "CS_HKPACKET"): {"MEMORYCSERRCOUNTER": (0, 12), "EEPROMCSERRCOUNTER": (0, 9),
                            "APPCSERRCOUNTER": (0, 0), "PASSCOUNTER": (40, 40)},
    ("CFE_SB", "CFE_SB_HKMSG"): {"CMDERRCNT": (0, 22), "COMMANDCNT": (30, 30)},
    ("CI", "CI_DEBUG_HKPACKET"): {"INGEST_PACKETS": (55, 920), "ERRCOUNTER": (0, 0)},
    ("STPYLD", "STPYLD_HK_TLM"): {"GyroX": (0.02, 5.2), "GyroY": (0.01, 4.8), "GyroZ": (0.03, 5.5),
                                  "Temperature": (22.5, 71.0)},
    ("CAMERA", "CAMERA_HK_TLM"): {"LastImageSizeBytes": (520000, 52000000), "ImageCounter": (12, 12),
                                  "CommandErrorCount": (0, 0)},
    ("DS", "DS_HKPACKET"): {"FILEWRITECOUNTER": (12, 540), "FILEWRITEERRCOUNTER": (0, 0)},
    ("SPACECOP", "SPACECOP_HK_TLM"): {"DEVICE_ERR_COUNT": (0, 7), "CMD_COUNT": (20, 20)},
}


def _tlm_metric_doc(off, target, packet, params):
    return {"@timestamp": _now_iso(off), "pipeline_source": "zeek-ccsds",
            "event": {"module": "cosmos", "dataset": "space.telemetry"},
            "target_name": target, "packet_name": packet, "parameters": params}


def seed_telemetry_metrics(es):
    """Baseline nominal telemetry (with small variance so the ML learns 'normal') across the
    payloads over the 5-day window, plus a late anomalous reading per packet, into
    logs-pisat-telemetry — the abnormal-telemetry ML store. Deploy telemetry_ml AFTER this."""
    docs = []
    span, steps = BASELINE_SPAN, 200
    step = span // steps
    for i in range(steps):
        off = -span + i * step
        wob = ((i * 37) % 11 - 5) / 100.0     # deterministic +/-5% wobble
        for (tgt, pkt), metrics in _TLM_METRICS.items():
            params = {}
            for f, (nom, _a) in metrics.items():
                if isinstance(nom, float):
                    params[f] = round(nom * (1 + wob), 3)
                elif nom:
                    params[f] = int(round(nom * (1 + wob)))
                else:
                    params[f] = i % 2                 # nominal-0 counters: tiny 0/1 variance
            docs.append(_tlm_metric_doc(off, tgt, pkt, params))
    # late anomalies (~last 25 min): one off-nominal reading per packet
    for j, ((tgt, pkt), metrics) in enumerate(_TLM_METRICS.items()):
        docs.append(_tlm_metric_doc(-1500 + j * 5, tgt, pkt, {f: a for f, (_n, a) in metrics.items()}))
    return _bulk(es, TELEM_INDEX, docs)


def teardown_data(es):
    """Delete every seeded DEFCON doc from the shared core partitions — identified by
    pipeline_source (the DEFCON lane, which survives the chain; core data never uses
    it), never the partition or core data. Scan _source and delete by id."""
    total = 0
    # The baseline spans 5 days, so scan the whole window and paginate (point-in-time +
    # search_after) so no seeded doc is missed among the core data; bulk-delete matches.
    for idx in ("logs.ecs.spacecraft.commands", "logs.ecs.spacecraft.memory",
                "logs.ecs.spacecraft.health", "logs.ecs.spacecraft.events", "logs.ecs"):
        try:
            es.indices.refresh(index=idx)
            pit = es.open_point_in_time(index=idx, keep_alive="2m").body["id"]
            after = None
            try:
                while True:
                    body = {"size": 5000, "query": {"range": {"@timestamp": {"gte": "now-6d"}}},
                            "sort": [{"@timestamp": "asc"}, {"_shard_doc": "asc"}],
                            "pit": {"id": pit, "keep_alive": "2m"}}
                    if after is not None:
                        body["search_after"] = after
                    resp = es.search(**body).body
                    pit = resp.get("pit_id", pit)
                    hits = resp["hits"]["hits"]
                    if not hits:
                        break
                    ops = [{"delete": {"_index": h["_index"], "_id": h["_id"]}}
                           for h in hits if h["_source"].get("pipeline_source") in _DEFCON_LANES]
                    if ops:
                        es.bulk(operations=ops)
                        total += len(ops)
                    if len(hits) < 5000:
                        break
                    after = hits[-1]["sort"]
            finally:
                es.close_point_in_time(id=pit)
            es.indices.refresh(index=idx)
        except Exception:  # noqa: BLE001 — index may not exist
            pass
    # the portal auth index is DEFCON-only — drop it wholesale (it auto-creates as a
    # data stream under the logs-* create-op path, so try the data-stream delete first)
    try:
        es.indices.delete_data_stream(name=PORTAL_INDEX)
    except Exception:  # noqa: BLE001
        try:
            es.indices.delete(index=PORTAL_INDEX, ignore_unavailable=True)
        except Exception:  # noqa: BLE001
            pass
    # the telemetry store is DEFCON-only too — drop it wholesale
    try:
        es.indices.delete_data_stream(name=TELEM_INDEX)
    except Exception:  # noqa: BLE001
        try:
            es.indices.delete(index=TELEM_INDEX, ignore_unavailable=True)
        except Exception:  # noqa: BLE001
            pass
    return total
