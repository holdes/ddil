"""
Builds the DEFCON pisat rule pack — SPARTA-STIX-structured, reading the core
partitions the pisat data conforms to. Commands land in logs.ecs.spacecraft.commands
(wire frame = source.ip present; operator release = user.name present), telemetry in
logs.ecs.spacecraft.{memory,health}, onboard-IDS alerts in logs.ecs.spacecraft.events.
Hazardous-command classification uses the core ref-hazardous-command catalog.
Writes each rule to rules/<rule_id>.ndjson.
"""
import json
from pathlib import Path

RULES_DIR = Path(__file__).resolve().parent.parent / "rules"
_RISK = {"low": 21, "medium": 47, "high": 73, "critical": 95}


def _mitre(tid, tname):
    return {"framework": "MITRE ATT&CK",
            "tactic": {"id": tid, "name": tname, "reference": f"https://attack.mitre.org/tactics/{tid}/"}}


def _sparta_threat(tac_id, tac_name, tech_id, tech_name):
    return {"framework": "SPARTA",
            "tactic": {"id": tac_id, "name": tac_name, "reference": "https://sparta.aerospace.org/"},
            "technique": [{"id": tech_id, "name": tech_name,
                           "reference": f"https://sparta.aerospace.org/technique/{tech_id}/"}]}


def _note(detection_logic, tactic, tech_id, tech_name, iob, iob_desc, validate):
    return (
        "## SPARTA Investigation Guide\n\n"
        f"### Detection logic\n{detection_logic}\n\n"
        "### Framework reference\n"
        f"- **Tactic:** {tactic}\n"
        f"- **Technique {tech_id}:** [{tech_name}](https://sparta.aerospace.org/technique/{tech_id}/)\n"
        f"- **Indicator of Behavior {iob}:** {iob_desc}\n\n"
        f"### Indicators of Behavior\n- **{iob}: {iob_desc}**\n\n"
        f"### How to validate this alert\n{validate}\n\n"
        "### References\n"
        f"- https://sparta.aerospace.org/technique/{tech_id}/")


def _rule(rule_id, name, description, query, severity, mitre_id, mitre_name,
          tac_id, tac_name, tech_id, tech_name, iob, iob_desc, detection_logic,
          validate, partitions, grounded_fields, false_positives):
    tags = ["DEFCON", "pisat", f"SPARTA Tactic: {tac_name}", f"SPARTA Technique: {tech_id}",
            f"SPARTA IOB: {iob}"] + [f"Data Source: {p}" for p in partitions]
    return {
        "rule_id": rule_id, "name": name, "description": description,
        "type": "esql", "language": "esql", "query": query,
        "from": "now-70m", "interval": "5m", "severity": severity, "risk_score": _RISK[severity],
        "max_signals": 100, "enabled": True, "author": ["Elastic"], "license": "Apache-2.0",
        "false_positives": false_positives, "tags": tags,
        "threat": [_mitre(mitre_id, mitre_name), _sparta_threat(tac_id, tac_name, tech_id, tech_name)],
        "note": _note(detection_logic, tac_name, tech_id, tech_name, iob, iob_desc, validate),
        "sparta": {"version": "3.2", "techniques": [tech_id], "iobs": [iob], "segment": "Space",
                   "partitions": partitions, "grounded_fields": grounded_fields},
    }


_CMDS = "logs.ecs.spacecraft.commands"
_MEM = "logs.ecs.spacecraft.memory"
_HEALTH = "logs.ecs.spacecraft.health"
_EVENTS = "logs.ecs.spacecraft.events"

RULES = [
    # 1. hazardous command matched to the core hazardous-command catalog (command feed).
    #    Attribution to an operator is done separately, at query time, by the AI agent
    #    from the portal registration log — the command feed carries no user.name.
    _rule(
        rule_id="defcon-mire7-esql",
        name="MIRE-7: Unexpected Memory Value Write or Modification",
        description="A destructive on-board command (memory poke, EEPROM-write enable, integrity-monitor "
        "disable, clock set) observed on the command feed, matched against the core hazardous-command "
        "catalog. Surfaces the destructive command regardless of who issued it, including a wire injection.",
        query=f"FROM {_CMDS}\n"
        "| WHERE @timestamp >= NOW() - 1 hour AND command.name IS NOT NULL\n"
        "| LOOKUP JOIN ref-hazardous-command ON command.name\n"
        "| WHERE hazardous == \"true\"\n"
        "| KEEP @timestamp, source.ip, target_name, command.name, reason, criticality\n| LIMIT 100",
        severity="high", mitre_id="TA0002", mitre_name="Execution",
        tac_id="EX", tac_name="Execution", tech_id="EX-0012", tech_name="Modify On-Board Values",
        iob="MIRE-7", iob_desc="Unexpected write or modification of on-board memory/configuration values.",
        detection_logic="An ES|QL rule over the command feed that joins each command against the core "
        "hazardous-command catalog and flags any match, surfacing destructive commanding on the wire. "
        "Operator attribution is performed separately by the AI agent from the portal registration log.",
        validate="Confirm command.name is in the hazardous-command catalog. Correlate with the on-board "
        "IDS alert and the telemetry effects, and ask the AI agent to attribute the command to a "
        "registered operator via the portal log. See spartastixkb for countermeasures.",
        partitions=[_CMDS], grounded_fields=["command.name", "target_name", "source.ip"],
        false_positives=["Authorized scheduled memory maintenance issues the same commands. Tune per "
                         "mission via detection exceptions at deployment."],
    ),
    # 2. valid-command flooding from one source (rate-based)
    _rule(
        rule_id="defcon-uace9-esql",
        name="UACE-9: Valid Command Flooding",
        description="An abnormally high volume of commands from one source in a short window — a command "
        "flood, whether a denial attempt or rapid attack automation.",
        query=f"FROM {_CMDS}\n"
        "| WHERE @timestamp >= NOW() - 2 hours AND source.ip IS NOT NULL\n"
        "| STATS commands = COUNT(*) BY source.ip, window = BUCKET(@timestamp, 5 minute)\n"
        "| WHERE commands > 8\n"
        "| KEEP source.ip, window, commands\n| LIMIT 100",
        severity="medium", mitre_id="TA0002", mitre_name="Execution",
        tac_id="EX", tac_name="Execution", tech_id="EX-0013", tech_name="Flooding",
        iob="UACE-9", iob_desc="An abnormally high rate of valid commands from one source.",
        detection_logic="An ES|QL aggregation over the command feed that counts commands per source per "
        "five-minute window and flags any source exceeding the routine rate, surfacing a command flood "
        "on the channel.",
        validate="Review the source's command sequence for the window. A burst of destructive or "
        "repeated commands is high-confidence abuse; a burst of routine housekeeping may be a script. "
        "Correlate with the hazardous-command rule and ask the AI agent to attribute the source. "
        "See spartastixkb.",
        partitions=[_CMDS], grounded_fields=["source.ip"],
        false_positives=["An authorized operations script or planned command burst produces high volume. "
                         "Tune the threshold and add exceptions per mission."],
    ),
    # 5. onboard IDS (SPACECOP) alert — the satellite's own detection (space.events)
    _rule(
        rule_id="defcon-siuu2-esql",
        name="SIUU-2: Unexpected System Integrity Failures in Software",
        description="The spacecraft's onboard intrusion-detection app (SPACECOP) raised an alert in its "
        "telemetry — the satellite itself flagged tampering. Surfaces the on-board detection directly "
        "and closes the command→effect loop.",
        query=f"FROM {_EVENTS}\n"
        "| WHERE @timestamp >= NOW() - 1 hour AND target_name == \"SPACECOP\" "
        "AND packet_name == \"SPACECOP_REPORT_TLM\"\n"
        r'| GROK message "\\[SPACECOP\\] %{DATA:spacecop.category}: %{GREEDYDATA:spacecop.detail}"'
        "\n"
        r'| GROK message "SPARTA ID=%{DATA:spacecop.sparta_id} \\(%{GREEDYDATA:spacecop.description}\\)"'
        "\n"
        r'| GROK message "Command Flooding Detected: %{DATA:spacecop.subject} at %{NUMBER:spacecop.rate} cmd/min \\(threshold: %{NUMBER:spacecop.threshold}\\)"'
        "\n"
        r'| GROK message "ML Anomaly Detected: %{DATA:spacecop.system} %{DATA:spacecop.data_type} - Feature: %{GREEDYDATA:spacecop.feature}"'
        "\n"
        r'| GROK message "Replay Attack Detected: Duplicate packet %{GREEDYDATA:spacecop.replay_packet}"'
        "\n"
        r'| GROK message "CTI-based Detected \\(SPARTA-ID %{DATA:spacecop.cti_id}, file \\(%{DATA:spacecop.file} \\(sha256=%{DATA:spacecop.sha256}\\)\\)found"'
        "\n"
        '| EVAL `spacecop.category` = CASE(`spacecop.cti_id` IS NOT NULL, "CTI-based Detected", `spacecop.category`)\n'
        "| KEEP @timestamp, target_name, packet_name, message, spacecop.category, "
        "spacecop.sparta_id, spacecop.description, spacecop.subject, spacecop.rate, "
        "spacecop.threshold, spacecop.system, spacecop.data_type, spacecop.feature, "
        "spacecop.replay_packet, spacecop.cti_id, spacecop.file, spacecop.sha256, "
        "PACKETID_EVENTTYPE\n| LIMIT 100",
        severity="high", mitre_id="TA0002", mitre_name="Execution",
        tac_id="EX", tac_name="Execution", tech_id="EX-0005",
        tech_name="Exploit Hardware/Firmware Corruption",
        iob="SIUU-2", iob_desc="An on-board integrity/intrusion monitor reported an anomalous condition.",
        detection_logic="An ES|QL rule over the events feed that flags every SPACECOP on-board IDS "
        "report (SPACECOP_REPORT_TLM) and PARSES the alert message so the alert exposes the SPECIFIC "
        "finding the satellite's IDS named — PER EVENT, not a single fixed label. It parses ALL five "
        "SPACECOP message formats: IOB-detected (`spacecop.sparta_id` e.g. SMSR-3 + `spacecop.description`), "
        "command-flooding (`spacecop.subject`/`spacecop.rate`/`spacecop.threshold`), ML-anomaly "
        "(`spacecop.system`/`spacecop.data_type`/`spacecop.feature`), replay-attack "
        "(`spacecop.replay_packet`), and CTI hash-match (`spacecop.cti_id`/`spacecop.file`/`spacecop.sha256`), "
        "all labeled by `spacecop.category`. The onboard IDS raising a report at all is the SIUU-2 signal; "
        "the exact IOB/finding rides in the exposed fields (different reports carry different indicators).",
        validate="Read `spacecop.sparta_id` for the specific IOB the onboard IDS flagged and "
        "`spacecop.description` for the detail. Correlate the timing with the hazardous-command and "
        "flooding rules and the telemetry effects, and ask the AI agent to attribute the triggering "
        "command via the portal log. See spartastixkb.",
        partitions=[_EVENTS],
        grounded_fields=["target_name", "packet_name", "message", "spacecop.category",
                         "spacecop.sparta_id", "spacecop.description", "spacecop.subject",
                         "spacecop.rate", "spacecop.threshold", "spacecop.system",
                         "spacecop.data_type", "spacecop.feature", "spacecop.replay_packet",
                         "spacecop.cti_id", "spacecop.file", "spacecop.sha256"],
        false_positives=["An onboard IDS self-test or a benign anomaly can raise an informational "
                         "message. Scope to alert-level messages; tune per mission via exceptions."],
    ),
    # 6. EFFECT: on-board integrity monitoring disabled (space.memory)
    _rule(
        rule_id="defcon-mire2-esql",
        name="MIRE-2: Anomalous Flash/EEPROM Memory Checksums Detected",
        description="The on-board Checksum app reports integrity monitoring disabled — the effect of an "
        "attack that turned off memory/EEPROM checksumming. Read from the memory telemetry partition.",
        query=f"FROM {_MEM}\n"
        "| WHERE @timestamp >= NOW() - 1 hour AND fswApp == \"CS\" "
        "AND (cs.checksumState == \"DISABLED\" OR cs.eepromState == \"DISABLED\")\n"
        "| KEEP @timestamp, fswApp, cs.checksumState, cs.eepromState, cs.memoryState\n| LIMIT 100",
        severity="high", mitre_id="TA0002", mitre_name="Execution",
        tac_id="EX", tac_name="Execution", tech_id="EX-0004", tech_name="Compromise Boot Memory",
        iob="MIRE-2", iob_desc="On-board memory checksum state anomalous (integrity monitoring disabled).",
        detection_logic="An ES|QL rule over the memory telemetry that flags the CS app reporting "
        "checksum or EEPROM integrity monitoring disabled — the effect of a CS-disable command or a "
        "tampering attempt.",
        validate="Correlate the timing with a CS-disable or memory command and the attributed hazardous "
        "rule. Integrity monitoring off on a live spacecraft is high-severity. See spartastixkb.",
        partitions=[_MEM], grounded_fields=["fswApp", "cs.checksumState"],
        false_positives=["An authorized checksum reconfiguration during maintenance disables it briefly. "
                         "Tune per mission via detection exceptions at deployment."],
    ),
    # 7. EFFECT: anomalous CPU utilization / processor stress (space.health)
    _rule(
        rule_id="defcon-smsr2-esql",
        name="SMSR-2: High CPU Utilization Due to Anomalous/Malicious Activity",
        description="The on-board Health & Safety app reports the CPU-hogging indicator active — "
        "processor stress consistent with malicious code or a command flood. Read from the health "
        "telemetry partition.",
        query=f"FROM {_HEALTH}\n"
        "| WHERE @timestamp >= NOW() - 1 hour AND fswApp == \"HS\" AND hs.cpuHogState == \"ENABLED\"\n"
        "| KEEP @timestamp, fswApp, hs.cpuHogState, hs.statusFlags\n| LIMIT 100",
        severity="medium", mitre_id="TA0002", mitre_name="Execution",
        tac_id="EX", tac_name="Execution", tech_id="EX-0010", tech_name="Malicious Code",
        iob="SMSR-2", iob_desc="Anomalously high CPU utilization from anomalous or malicious activity.",
        detection_logic="An ES|QL rule over the health telemetry that flags the HS app's CPU-hogging "
        "indicator active — processor stress from malicious code or a command flood.",
        validate="Correlate with the command-flooding rule and any recent code/table load. Sustained "
        "high CPU on a spacecraft risks watchdog resets. See spartastixkb.",
        partitions=[_HEALTH], grounded_fields=["fswApp", "hs.cpuHogState"],
        false_positives=["A scheduled compute-heavy payload task raises CPU legitimately. Tune the "
                         "threshold and add exceptions per mission."],
    ),
    # 8. CORRELATION: attributed disable command AND its on-board effect (command -> effect)
    _rule(
        rule_id="defcon-mire2-corr",
        name="MIRE-2: Anomalous Flash/EEPROM Memory Checksums Detected",
        description="A checksum-disable command issued through the console AND the on-board Checksum "
        "app reporting integrity monitoring disabled in the same window — the attack command and its "
        "confirmed effect on the satellite together. The highest-confidence compromise signal.",
        query=f"FROM {_CMDS}, {_MEM}\n"
        "| WHERE @timestamp >= NOW() - 1 hour\n"
        "| EVAL disable_cmd = CASE(command.name == \"CS_DISABLE_ALL_CS\", 1, 0), "
        "cs_off = CASE(cs.checksumState == \"DISABLED\", 1, 0)\n"
        "| STATS commands = SUM(disable_cmd), effects = SUM(cs_off)\n"
        "| WHERE commands > 0 AND effects > 0\n"
        "| KEEP commands, effects\n| LIMIT 100",
        severity="critical", mitre_id="TA0002", mitre_name="Execution",
        tac_id="EX", tac_name="Execution", tech_id="EX-0004", tech_name="Compromise Boot Memory",
        iob="MIRE-2", iob_desc="A memory-integrity command and its confirmed on-board effect, correlated.",
        detection_logic="An ES|QL correlation over the command feed and the memory telemetry that fires "
        "when a checksum-disable command and the on-board checksum-disabled state both appear in the "
        "window — the attack command and its confirmed effect on the spacecraft.",
        validate="This is command-and-effect confirmed. Attribute via the operator user.name on the "
        "disable command, and respond as a live integrity compromise. See spartastixkb.",
        partitions=[_CMDS, _MEM], grounded_fields=["command.name", "cs.checksumState"],
        false_positives=["Authorized maintenance that both disables checksumming and issues the command "
                         "will correlate. Tune per mission via detection exceptions."],
    ),
]


def build():
    RULES_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    for r in RULES:
        p = RULES_DIR / f"{r['rule_id']}.ndjson"
        p.write_text(json.dumps(r) + "\n")
        written.append(p.name)
    return written


if __name__ == "__main__":
    for n in build():
        print("wrote", n)
