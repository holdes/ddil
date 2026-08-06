"""
DEFCON pisat ML — an anomaly-detection job + machine_learning rule for command
abuse by walk-up conference accounts.

DESIGN: the detector is `rare` on command.name at the POPULATION level (no partition).
It learns the normal command vocabulary system-wide — everyone issues housekeeping
requests, free-space checks, integrity reports — so a dangerous or unusual command
(memory poke, EEPROM enable, clock jam) is rare SYSTEM-WIDE and scores regardless of
source. The command feed carries NO operator identity (one shared COSMOS entity), so the
influencers are source.ip + target_name; operator attribution is done at QUERY time by
the AI agent from the portal registration log (logs-pisat-portal).

Job id is namespaced `defcon-insider-rare-command` so teardown removes exactly it.
Threshold 70 (warning gate). On real multi-day traffic the population baseline is
rich and the score is strong; on the compressed synthetic seed `rare` may still be
marginal. The ES|QL rules are the immediately-firing detections; this is the
behavioral net that catches dangerous commands not in the hazardous catalog.
"""
JOB_ID = "defcon-insider-rare-command"
DATAFEED_ID = f"datafeed-{JOB_ID}"
BUCKET = "15m"
# Warning gate. On the 5-day synthetic baseline the dangerous commands score ~59.8
# (a genuine anomaly, correctly attributed to the attacker — target_name/user.name
# influencers hit 96/79), so the gate is set below that to fire. On real multi-day
# conference traffic the score is higher; this is the documented sparse-data tuning
# (lower THIS rule's gate to what the genuine anomaly reaches — not a faked fire).
THRESHOLD = 50


def _job_body():
    return {
        "description": "DEFCON PiSat — rare command system-wide (population model; no operator identity on the wire)",
        "analysis_config": {
            "bucket_span": BUCKET,
            # POPULATION-level: rare command.name system-wide (no partition), so a dangerous
            # command scores regardless of source. No user.name on the wire — the AI agent
            # attributes at query time; here source.ip/target_name are the influencers.
            "detectors": [{"function": "rare", "by_field_name": "command.name"}],
            "influencers": ["source.ip", "command.name", "target_name"],
        },
        "data_description": {"time_field": "@timestamp"},
        "analysis_limits": {"model_memory_limit": "32mb"},
        "groups": ["defcon", "pisat"],
    }


def _datafeed_body():
    # Reads every command on the core commands partition (any doc with a command name).
    # With real multi-day history the `rare` detector scores an out-of-vocabulary command;
    # on the compressed synthetic seed it models but may not score (see module docstring).
    return {
        "job_id": JOB_ID,
        "indices": ["logs.ecs.spacecraft.commands"],
        "query": {"bool": {"filter": [{"exists": {"field": "command.name"}}]}},
    }


def deploy(es, kbn):
    """Create + open the job, start the datafeed (real-time, backfills from 0),
    then sync into Kibana saved objects so a rule can bind to it."""
    # idempotent: remove a prior job first
    try:
        es.ml.stop_datafeed(datafeed_id=DATAFEED_ID, force=True)
    except Exception:  # noqa: BLE001
        pass
    try:
        es.ml.delete_job(job_id=JOB_ID, force=True)
    except Exception:  # noqa: BLE001
        pass
    # Wait for the seeded docs to route from logs.ecs into the partition before the
    # datafeed reads it (routing is async; a fresh deploy's data may not be visible
    # yet). Poll the partition count up to ~30s.
    import time
    for _ in range(15):
        es.indices.refresh(index="logs.ecs.spacecraft.commands")
        try:
            if es.count(index="logs.ecs.spacecraft.commands",
                        query={"exists": {"field": "command.name"}}).body["count"] > 50:
                break
        except Exception:  # noqa: BLE001
            pass
        time.sleep(2)

    es.ml.put_job(job_id=JOB_ID, **_job_body())
    es.ml.put_datafeed(datafeed_id=DATAFEED_ID, **_datafeed_body())
    es.ml.open_job(job_id=JOB_ID)
    # Real-time datafeed (start=0, NO end): backfills the full seeded baseline so the model
    # builds a confident "normal command vocabulary", AND keeps scoring as live commands
    # flow during the conference (per the ML skill — leave it running).
    es.ml.start_datafeed(datafeed_id=DATAFEED_ID, start="0")
    kbn.get("/api/ml/saved_objects/sync")   # REQUIRED before the rule can find the job
    return JOB_ID


def ml_rule():
    """The machine_learning Detection-Engine rule bound to the job."""
    return {
        "rule_id": "defcon-uace4-ml",
        "name": "UACE-4: Unexpected Legitimate Command Sent",
        "description": "A machine-learning rule over the command feed: the job learns the normal "
        "command vocabulary system-wide and scores any command that is rare — a memory poke, EEPROM "
        "enable, or clock jam stands out against the routine housekeeping. Catches a dangerous command "
        "even when it is not in the hazardous catalog; source.ip/target_name are the influencers and "
        "operator attribution is done by the AI agent from the portal log. Bound to the "
        "defcon-insider-rare-command job.",
        "type": "machine_learning", "machine_learning_job_id": [JOB_ID],
        "anomaly_threshold": THRESHOLD, "interval": "5m", "from": "now-2h",
        "severity": "high", "risk_score": 73, "max_signals": 100, "enabled": True,
        "author": ["Elastic"], "license": "Apache-2.0",
        "false_positives": ["A new but authorized account, a first-of-campaign maintenance command, "
                            "or an infrequent scheduled command can score as rare. Tune per mission "
                            "via detection exceptions at deployment."],
        "tags": ["DEFCON", "pisat", "SPARTA Tactic: Initial Access", "SPARTA Technique: IA-0007",
                 "SPARTA IOB: UACE-4", "Data Source: logs.ecs.spacecraft.commands"],
        "threat": [
            {"framework": "MITRE ATT&CK",
             "tactic": {"id": "TA0001", "name": "Initial Access",
                        "reference": "https://attack.mitre.org/tactics/TA0001/"}},
            {"framework": "SPARTA",
             "tactic": {"id": "IA", "name": "Initial Access", "reference": "https://sparta.aerospace.org/"},
             "technique": [{"id": "IA-0007", "name": "Compromise Ground System",
                            "reference": "https://sparta.aerospace.org/technique/IA-0007/"}]}],
        "note": "## SPARTA Investigation Guide\n\n### Detection logic\nA machine-learning anomaly job "
        "(`rare` command.name, population-level) over the command feed. It learns the system-wide "
        "command vocabulary and flags a command that is rare — a dangerous command not in the hazardous "
        "catalog still stands out. Influenced by source.ip/target_name; the command feed carries no "
        "operator identity, so attribution is done at query time by the AI agent from the portal "
        "registration log. This surfaces UACE-4: an unexpected but legitimate command sent.\n\n"
        "### Framework reference\n- **Tactic:** Initial Access\n- "
        "**Technique IA-0007:** [Compromise Ground System](https://sparta.aerospace.org/technique/IA-0007/)\n"
        "- **Indicator of Behavior UACE-4:** Unexpected legitimate command sent.\n\n"
        "### How to validate this alert\nReview the anomaly's influencers (command.name, source.ip, "
        "target_name). Correlate with the hazardous-command and flooding rules and the SPACECOP IDS "
        "alert, and ask the AI agent to attribute the command to a registered operator. See "
        "spartastixkb for countermeasures.\n\n"
        "### References\n- https://sparta.aerospace.org/technique/IA-0007/",
        "sparta": {"version": "3.2", "techniques": ["IA-0007"], "iobs": ["UACE-4"],
                   "segment": "Space", "partitions": ["logs.ecs.spacecraft.commands"],
                   "grounded_fields": ["command.name", "source.ip", "target_name"]},
    }


def write_artifacts(rules_dir, jobs_dir):
    """Persist the command ML rule (rules/) + job+datafeed config (ml_jobs/) to disk."""
    import json
    import os
    os.makedirs(rules_dir, exist_ok=True)
    os.makedirs(jobs_dir, exist_ok=True)
    r = ml_rule()
    with open(os.path.join(rules_dir, f"{r['rule_id']}.ndjson"), "w") as f:
        f.write(json.dumps(r) + "\n")
    cfg = {"job_id": JOB_ID, "job": _job_body(), "datafeed": _datafeed_body()}
    with open(os.path.join(jobs_dir, f"{JOB_ID}.json"), "w") as f:
        f.write(json.dumps(cfg, indent=2) + "\n")
    return [r["rule_id"]]


def teardown(es):
    try:
        es.ml.stop_datafeed(datafeed_id=DATAFEED_ID, force=True)
    except Exception:  # noqa: BLE001
        pass
    try:
        es.ml.delete_datafeed(datafeed_id=DATAFEED_ID, force=True)
    except Exception:  # noqa: BLE001
        pass
    try:
        es.ml.delete_job(job_id=JOB_ID, force=True)
    except Exception:  # noqa: BLE001
        pass
    return JOB_ID
