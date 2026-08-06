"""
DEFCON pisat — ABNORMAL-TELEMETRY anomaly-detection ML jobs + machine_learning rules.

All pisat telemetry lands in the `logs-pisat-telemetry` index (the shipper types the
numeric parameters as numbers). These jobs score abnormal telemetry regardless of who
commanded the spacecraft — no operator identity needed — so they cover the case where a
dangerous command is missed but its EFFECT shows up in the housekeeping telemetry.

EVERY field is grounded in the pisat telemetry dictionary
(the-aerospace-corporation/spacecop-demo, gsw/cosmos_definitions.json) — nothing invented.
Each job reads exactly one packet (datafeed filters on packet_name) and models one metric
(or a small correlated set), influenced by packet_name/target_name.

Coverage spans the payloads/subsystems: EPS (power), SYSMON (host resources), HS + CFE_ES
(cFS health/resets), CS (memory/EEPROM integrity), CFE_SB + CI (command paths), STPYLD
(attitude/IMU + thermal), CAMERA + DS (payload/exfil), SPACECOP (onboard IDS health).
"""
TELEM_INDEX = "logs-pisat-telemetry"
BUCKET = "15m"
THRESHOLD = 50   # conference warning gate (matches the command ML)

# (short, target, packet_name, [parameters.<field>...], function, mitre_id, mitre_name,
#  tac_id, tac_name, tech_id, tech_name, severity, rationale)
_EXEC = ("TA0002", "Execution", "EX", "Execution")
_IMP  = ("TA0040", "Impact", "IMP", "Impact")
_EXF  = ("TA0010", "Exfiltration", "EXF", "Exfiltration")

JOBS = [
    ("batt-volt", "EPS", "EPS_HK_TLM", ["parameters.BatteryV"], "low_mean", _IMP,
     "IMP-0002", "Disruption", "high",
     "Battery voltage sag — power drain from an unauthorized load, forced high-duty payload, or DoS."),
    ("batt-current", "EPS", "EPS_HK_TLM", ["parameters.BatteryMa"], "high_mean", _IMP,
     "IMP-0002", "Disruption", "medium",
     "Abnormal battery discharge current — rogue power-consuming activity on the bus."),
    ("eps-err", "EPS", "EPS_HK_TLM", ["parameters.ErrorCount"], "high_mean", _IMP,
     "IMP-0004", "Degradation", "medium",
     "EPS error surge — power-subsystem faults or command tampering."),
    ("cpu-load", "SYSMON", "SYSMON_HK_TLM", ["parameters.CPULoadPercent"], "high_mean", _EXEC,
     "EX-0010", "Malicious Code", "high",
     "CPU saturation on the flight host — malicious code, crypto-mining, or a flooding effect."),
    ("cpu-temp", "SYSMON", "SYSMON_HK_TLM", ["parameters.CPUTempC"], "high_mean", _IMP,
     "IMP-0002", "Disruption", "medium",
     "CPU thermal rise from sustained illicit compute."),
    ("mem-free", "SYSMON", "SYSMON_HK_TLM", ["parameters.FreeMemoryKB"], "low_mean", _EXEC,
     "EX-0010", "Malicious Code", "medium",
     "Memory exhaustion — a leak or a resident implant."),
    ("disk-free", "SYSMON", "SYSMON_HK_TLM", ["parameters.DiskFreeMB"], "low_mean", _EXF,
     "EXF-0003.02", "Downlink Exfiltration", "medium",
     "Disk filling up — illicit data staging before exfiltration."),
    ("hs-resets", "HS", "HS_HKPACKET", ["parameters.RESETSPERFORMED"], "high_mean", _EXEC,
     "EX-0010", "Malicious Code", "high",
     "Autonomous processor-reset spike — crashing/hung apps from malicious code."),
    ("hs-cpuavg", "HS", "HS_HKPACKET", ["parameters.UTILCPUAVG"], "high_mean", _EXEC,
     "EX-0010", "Malicious Code", "high",
     "Sustained CPU-hog condition flagged by the onboard Health & Safety monitor."),
    ("es-resets", "CFE_ES", "CFE_ES_HKPACKET", ["parameters.PROCESSORRESETS"], "high_mean", _IMP,
     "IMP-0003", "Denial", "high",
     "cFE processor-reset count climbing — repeated exploitation or instability."),
    ("es-heapfree", "CFE_ES", "CFE_ES_HKPACKET", ["parameters.HEAPBYTESFREE"], "low_mean", _EXEC,
     "EX-0010", "Malicious Code", "medium",
     "cFE heap exhaustion — a memory-consuming implant."),
    ("cs-memerr", "CS", "CS_HKPACKET", ["parameters.MEMORYCSERRCOUNTER"], "high_mean", _EXEC,
     "EX-0012", "Modify On-Board Values", "high",
     "RAM checksum failures — in-memory code/data tampering."),
    ("cs-eepromerr", "CS", "CS_HKPACKET", ["parameters.EEPROMCSERRCOUNTER"], "high_mean", _EXEC,
     "EX-0012", "Modify On-Board Values", "high",
     "EEPROM checksum failures — persistent firmware tampering."),
    ("sb-cmderr", "CFE_SB", "CFE_SB_HKMSG", ["parameters.CMDERRCNT"], "high_mean", _EXEC,
     "EX-0013", "Flooding", "medium",
     "Software-bus command-error surge — malformed or unauthorized command injection."),
    ("ci-ingest", "CI", "CI_DEBUG_HKPACKET", ["parameters.INGEST_PACKETS"], "high_mean", _EXEC,
     "EX-0013", "Flooding", "high",
     "Command-Ingest uplink packet-rate spike — command flooding or replay at the receiver."),
    ("attitude", "STPYLD", "STPYLD_HK_TLM",
     ["parameters.GyroX", "parameters.GyroY", "parameters.GyroZ"], "high_mean", _EXEC,
     "EX-0014", "Spoofing", "high",
     "Anomalous body rates — attitude/IMU sensor spoofing or an unauthorized maneuver."),
    ("pyld-temp", "STPYLD", "STPYLD_HK_TLM", ["parameters.Temperature"], "high_mean", _IMP,
     "IMP-0002", "Disruption", "medium",
     "Payload thermal anomaly."),
    ("cam-imgsize", "CAMERA", "CAMERA_HK_TLM", ["parameters.LastImageSizeBytes"], "high_mean", _EXF,
     "EXF-0003.02", "Downlink Exfiltration", "medium",
     "Abnormal image size — a large payload staged for exfiltration."),
    ("ds-filewrite", "DS", "DS_HKPACKET", ["parameters.FILEWRITECOUNTER"], "high_mean", _EXF,
     "EXF-0003.02", "Downlink Exfiltration", "medium",
     "File-write burst on the data store — mass data staging."),
    ("spacecop-deverr", "SPACECOP", "SPACECOP_HK_TLM", ["parameters.DEVICE_ERR_COUNT"], "high_mean", _IMP,
     "IMP-0004", "Degradation", "medium",
     "Onboard IDS device-error rise — the security monitor itself seeing faults."),
]


def job_id(short):
    return f"defcon-tlm-{short}"


def _job_body(spec):
    short, target, packet, fields, func, tac, tech_id, tech_name, sev, why = spec
    return {
        "description": f"DEFCON PiSat telemetry anomaly — {why}",
        "analysis_config": {
            "bucket_span": BUCKET,
            "detectors": [{"function": func, "field_name": f} for f in fields],
            "influencers": ["packet_name", "target_name"],
        },
        "data_description": {"time_field": "@timestamp"},
        "analysis_limits": {"model_memory_limit": "16mb"},
        "groups": ["defcon", "pisat", "pisat-telemetry"],
    }


def _datafeed_body(spec):
    short, target, packet, fields, *_ = spec
    return {
        "job_id": job_id(short),
        "indices": [TELEM_INDEX],
        "query": {"bool": {"filter": [
            {"term": {"packet_name": packet}},
            {"exists": {"field": fields[0]}}]}},
    }


def deploy(es, kbn):
    """Create + open every telemetry job, backfill over the seeded window, and sync into
    Kibana saved objects so the machine_learning rules can bind."""
    import time
    for spec in JOBS:
        jid = job_id(spec[0])
        try:
            es.ml.stop_datafeed(datafeed_id=f"datafeed-{jid}", force=True)
        except Exception:  # noqa: BLE001
            pass
        try:
            es.ml.delete_job(job_id=jid, force=True)
        except Exception:  # noqa: BLE001
            pass
    try:
        es.indices.refresh(index=TELEM_INDEX)
    except Exception:  # noqa: BLE001
        pass
    n = 0
    for spec in JOBS:
        jid = job_id(spec[0])
        try:
            es.ml.put_job(job_id=jid, **_job_body(spec))
            es.ml.put_datafeed(datafeed_id=f"datafeed-{jid}", **_datafeed_body(spec))
            es.ml.open_job(job_id=jid)
            # real-time datafeed (start=0, NO end): backfills the seeded window AND keeps
            # scoring as live telemetry flows during the conference (per the ML skill).
            es.ml.start_datafeed(datafeed_id=f"datafeed-{jid}", start="0")
            n += 1
        except Exception as e:  # noqa: BLE001
            print(f"      {jid} skipped — {type(e).__name__}: {str(e)[:80]}")
    kbn.get("/api/ml/saved_objects/sync")
    return n


def _ml_rule(spec):
    short, target, packet, fields, func, tac, tech_id, tech_name, sev, why = spec
    tac_mid, tac_mname, tac_sid, tac_sname = tac
    jid = job_id(short)
    risk = {"low": 21, "medium": 47, "high": 73, "critical": 95}[sev]
    parent = tech_id.split(".")[0]
    return {
        "rule_id": f"{jid}-ml", "name": f"Abnormal telemetry: {target} {short.replace('-', ' ')}",
        "description": why, "type": "machine_learning", "machine_learning_job_id": [jid],
        "anomaly_threshold": THRESHOLD, "interval": "10m", "from": "now-2h",
        "severity": sev, "risk_score": risk, "max_signals": 100, "enabled": True,
        "author": ["Elastic"], "license": "Apache-2.0",
        "alert_suppression": {"group_by": ["packet_name", "target_name"],
                              "missing_fields_strategy": "suppress"},
        "false_positives": ["Authorized high-activity operations (a planned payload burst, a maintenance "
                            "window, an orbital eclipse for power) can move this metric. Tune per mission "
                            "via detection exceptions at deployment."],
        "tags": ["DEFCON", "pisat", "pisat-telemetry", f"SPARTA Tactic: {tac_sname}",
                 f"SPARTA Technique: {tech_id}", f"Data Source: {TELEM_INDEX}"],
        "threat": [
            {"framework": "MITRE ATT&CK",
             "tactic": {"id": tac_mid, "name": tac_mname,
                        "reference": f"https://attack.mitre.org/tactics/{tac_mid}/"}},
            {"framework": "SPARTA",
             "tactic": {"id": tac_sid, "name": tac_sname, "reference": "https://sparta.aerospace.org/"},
             "technique": [{"id": tech_id, "name": tech_name,
                            "reference": f"https://sparta.aerospace.org/technique/{parent}/"}]}],
        "note": "## SPARTA Investigation Guide\n\n"
        f"### Detection logic\nA machine-learning anomaly job (`{func}` on `{fields[0]}`) over the "
        f"`{packet}` telemetry in `{TELEM_INDEX}`. It learns the packet's normal range and flags a "
        f"deviation, attributed to the packet/subsystem via influencers. {why}\n\n"
        "### Framework reference\n"
        f"- **Tactic:** {tac_sname}\n"
        f"- **Technique {tech_id}:** [{tech_name}](https://sparta.aerospace.org/technique/{parent}/)\n\n"
        "### How to validate this alert\nConfirm the metric's deviation against the recent baseline, "
        "correlate its timing with the command feed (hazardous / flooding rules) and the SPACECOP IDS "
        "alert, and ask the AI agent to attribute any correlated command to a registered operator. "
        "See spartastixkb for countermeasures.\n\n"
        f"### References\n- https://sparta.aerospace.org/technique/{parent}/",
        "sparta": {"version": "3.2", "techniques": [tech_id], "iobs": [], "segment": "Space",
                   "partitions": [TELEM_INDEX], "grounded_fields": fields},
    }


def ml_rules():
    return [_ml_rule(s) for s in JOBS]


def write_artifacts(rules_dir, jobs_dir):
    """Persist the 20 telemetry ML rules (rules/) + job+datafeed configs (ml_jobs/) to disk
    so the whole rule/job set is inspectable as files, alongside the ES|QL rules."""
    import json
    import os
    os.makedirs(rules_dir, exist_ok=True)
    os.makedirs(jobs_dir, exist_ok=True)
    written = []
    for r in ml_rules():
        with open(os.path.join(rules_dir, f"{r['rule_id']}.ndjson"), "w") as f:
            f.write(json.dumps(r) + "\n")
        written.append(r["rule_id"])
    for spec in JOBS:
        jid = job_id(spec[0])
        cfg = {"job_id": jid, "job": _job_body(spec), "datafeed": _datafeed_body(spec)}
        with open(os.path.join(jobs_dir, f"{jid}.json"), "w") as f:
            f.write(json.dumps(cfg, indent=2) + "\n")
    return written


def teardown(es):
    removed = 0
    for spec in JOBS:
        jid = job_id(spec[0])
        for fn, kw in ((es.ml.stop_datafeed, {"datafeed_id": f"datafeed-{jid}", "force": True}),
                       (es.ml.delete_datafeed, {"datafeed_id": f"datafeed-{jid}", "force": True}),
                       (es.ml.delete_job, {"job_id": jid, "force": True})):
            try:
                fn(**kw)
            except Exception:  # noqa: BLE001
                pass
        removed += 1
    return removed
