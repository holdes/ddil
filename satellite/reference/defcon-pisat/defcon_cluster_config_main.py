#!/usr/bin/env python3
"""
DEFCON PiSat — the ONE entry point to deploy the DEFCON-scoped cluster config.

This deploys everything the Elastic cluster needs to run the DEFCON PiSat SPARTA
analytics, and tears it all back down. It is DEFCON-scoped only — the core/baseline
schema and analytics are deployed separately by the project's `main.py` and are a
PREREQUISITE (this pack conforms to the core partitions and joins the core
`ref-hazardous-command` lookup). Connects with the project's `.env`
(ES_URL / ES_APIKEY, via es_client / KibanaClient) — the same one the core uses.

    python defcon_cluster_config_main.py                 deploy the DEFCON config (+ seed demo data)
    python defcon_cluster_config_main.py --config-only   deploy without seeding demo data (for live)
    python defcon_cluster_config_main.py --teardown      remove everything this script created

What it deploys:
  • ensures the shared core `ref-hazardous-command` lookup exists,
  • (optional) seeds demo data — a 5-day benign command baseline + attack + on-board
    telemetry (into logs-pisat-telemetry) + portal registrations,
  • the `defcon-insider-rare-command` command ML job + 20 `defcon-tlm-*` telemetry
    anomaly ML jobs,
  • all detection rules from rules/ — the `defcon-*` ES|QL rules + `defcon-uace4-ml`
    + the 20 `defcon-tlm-*-ml` telemetry rules (rule + job artifacts are written to
    rules/ and ml_jobs/ so the whole set is inspectable as files).

The pisat data comes from the decoded Zeek feed + the access-portal log (no
microservices) and conforms to the EXISTING core partitions
(logs.ecs.spacecraft.commands / .memory / .health / .events); numeric telemetry
additionally lands in `logs-pisat-telemetry`. Commands are NOT attributed at ingest
(one shared COSMOS entity) — the portal registration log lands in `logs-pisat-portal`
and the AI agent attributes at query time. What it adds is namespaced so teardown is
exact and touches nothing core:
  • rules      defcon-* ES|QL + defcon-uace4-ml + defcon-tlm-*-ml (all in rules/)
  • demo data  pipeline_source ∈ {zeek-ccsds, pisat-portal} + logs-pisat-portal + logs-pisat-telemetry
  • ML jobs    defcon-insider-rare-command + defcon-tlm-*
The shared core `ref-hazardous-command` is ENSURED on deploy but never removed on
teardown (core rules depend on it).
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parents[1]          # …/space_cyber_security
sys.path.insert(0, str(PROJECT_ROOT))   # project modules (es_client, cluster_loader)
sys.path.insert(0, str(HERE))           # local cluster/ package

from es_client import get_elasticsearch_client          # noqa: E402
from cluster_loader.kibana_client import KibanaClient    # noqa: E402
from cluster import ref_data, payloads, rules_build, ml, telemetry_ml   # noqa: E402

RULES_DIR = HERE / "rules"
JOBS_DIR = HERE / "ml_jobs"


CORE_PARTITIONS = ["logs.ecs.spacecraft.commands", "logs.ecs.spacecraft.memory",
                   "logs.ecs.spacecraft.health", "logs.ecs.spacecraft.events"]


def _env_status():
    """Pinpoint WHY the connection isn't configured — missing venv/deps, missing .env
    file, or blank values — so the message is actionable. Returns an error string, or
    None if the .env looks populated (then the failure is a real connection error)."""
    root_env = PROJECT_ROOT / ".env"
    example = PROJECT_ROOT / ".env.example"
    if not root_env.exists():
        return (f"No .env file found at:\n        {root_env}\n"
                f"      Create it from the template and fill in your cluster:\n"
                f"        cp {example} {root_env}\n"
                f"      then set ES_URL / ES_APIKEY / KIBANA_URL / KIBANA_APIKEY.")
    try:
        from dotenv import dotenv_values
    except ImportError:
        return ("python-dotenv isn't installed in this Python, so the .env can't be read.\n"
                f"      Run with the project virtualenv (it has the deps), e.g.:\n"
                f"        {PROJECT_ROOT}/.venv/bin/python defcon_cluster_config_main.py\n"
                f"      or install deps:  pip install python-dotenv elasticsearch")
    vals = dotenv_values(root_env)
    missing = [k for k in ("ES_URL", "ES_APIKEY") if not (vals.get(k) or "").strip()]
    if missing:
        return (f".env exists at {root_env} but these are blank/commented: " + ", ".join(missing)
                + ".\n      Fill them in with your cluster's values (uncomment if needed).")
    return None  # .env is populated — the client failed for another reason


def _clients():
    """Both clients are built from the SAME project `.env` Blake ships in the repo
    (ES_URL / ES_APIKEY / KIBANA_URL / KIBANA_APIKEY). Returns (es, k); either is None
    if its connection isn't configured — the preflight turns that into a clear message."""
    es = get_elasticsearch_client()
    es = es.options(request_timeout=60) if es is not None else None
    try:
        k = KibanaClient()
    except Exception:  # noqa: BLE001 — missing/blank Kibana auth in .env
        k = None
    return es, k


def _preflight(es, k):
    """Verify BOTH connections (from the project .env) work and the CORE baseline is
    deployed — this DEFCON pack conforms to the core partitions. Returns an error
    string, or None if OK."""
    if es is None:
        return "No Elasticsearch connection.\n      " + (_env_status() or
               "ES_URL / ES_APIKEY are set but the client couldn't be built — check their values.")
    if k is None:
        return ("No Kibana connection — set KIBANA_URL and KIBANA_APIKEY (or reuse ES_APIKEY) "
                "in the project .env.\n      " + (_env_status() or ""))
    try:
        es.info()
    except Exception as e:  # noqa: BLE001
        return f"Cannot reach Elasticsearch — {type(e).__name__}: {str(e)[:120]} (check ES_URL in .env)."
    missing = [p for p in CORE_PARTITIONS if not es.indices.exists(index=p).body]
    if missing:
        return ("The core baseline is not deployed — missing partitions: " + ", ".join(missing)
                + ".\n      Deploy the core first from the project root:  python main.py\n"
                "      then re-run this script.")
    return None


# ── deploy ───────────────────────────────────────────────────────────────────
def _deploy_rules(k, rule_docs):
    ok = 0
    for rule in rule_docs:
        st, body = k.post("/api/detection_engine/rules", rule)
        if st == 409:
            st, body = k.put("/api/detection_engine/rules", rule)
        good = st in (200, 201)
        ok += good
        print(f"      {rule['rule_id']}: {'deployed' if good else 'ERROR ' + str(st) + ' ' + str(body)[:120]}")
    return ok, len(rule_docs) - ok


def deploy(seed=True):
    es, k = _clients()
    err = _preflight(es, k)
    if err:
        print("\nDEFCON PiSat — PREFLIGHT FAILED\n\n      " + err + "\n")
        return 2

    print("\nDEFCON PiSat — deploying the DEFCON-scoped cluster config\n")

    print("[1/4] Partitions — none (pisat data conforms to existing core partitions)")

    print("\n[2/4] Reference lookup — ensure shared core ref-hazardous-command")
    for name, key, n in ref_data.build(es):
        print(f"      {name}: {n} rows (key {key})")

    print("\n[3/4] Demo data" + ("" if seed else " — skipped (--config-only)"))
    if seed:
        b = payloads.seed_baseline(es)
        a = payloads.seed_attack(es)
        t = payloads.seed_telemetry_metrics(es)
        print(f"      baseline {b} + attack {a} docs → logs.ecs (+ portal registrations)")
        print(f"      telemetry {t} docs → logs-pisat-telemetry (abnormal-telemetry ML store)")

    print("\n[4/4] ML jobs + detection rules")
    # regenerate ALL rule + job artifacts to disk (rules/ + ml_jobs/) so the whole set is
    # inspectable as files, then deploy every rule from rules/ (one source of truth).
    rules_build.build()
    ml.write_artifacts(str(RULES_DIR), str(JOBS_DIR))
    telemetry_ml.write_artifacts(str(RULES_DIR), str(JOBS_DIR))
    try:
        print(f"      command ML {ml.deploy(es, k)}: created + datafeed running")
    except Exception as e:  # noqa: BLE001
        print(f"      command ML defcon-insider-rare-command skipped — {type(e).__name__}: {str(e)[:90]}")
    try:
        print(f"      telemetry ML: {telemetry_ml.deploy(es, k)} anomaly jobs created + datafeeds running")
    except Exception as e:  # noqa: BLE001
        print(f"      telemetry ML skipped — {type(e).__name__}: {str(e)[:90]}")
    rule_docs = [json.loads(p.read_text()) for p in sorted(RULES_DIR.glob("*.ndjson"))]
    ok, fail = _deploy_rules(k, rule_docs)
    print(f"      deployed {len(rule_docs)} rules from rules/ (ES|QL + ML)")

    print(f"\n{'✓ SUCCESS' if fail == 0 else '⚠ COMPLETED WITH ERRORS'} — {ok} rule(s) deployed"
          + (f", {fail} FAILED (see ERROR lines above)" if fail else "") + ".")
    print("Teardown with: python defcon_cluster_config_main.py --teardown\n")
    return 0 if fail == 0 else 1


# ── teardown ─────────────────────────────────────────────────────────────────
def teardown():
    es, k = _clients()
    if es is None or k is None:
        print("\nDEFCON PiSat — no cluster connection "
              "(set ES_URL / ES_APIKEY / KIBANA_URL / KIBANA_APIKEY in the project .env)\n")
        return 2
    print("\nDEFCON PiSat — tearing down everything this script created\n")

    print("[1/4] Detection rules ('not deployed' just means it wasn't there to remove)")
    rule_ids = ([r["rule_id"] for r in rules_build.RULES] + ["defcon-uace4-ml"]
                + [r["rule_id"] for r in telemetry_ml.ml_rules()])
    for rid in rule_ids:
        st, _ = k.delete(f"/api/detection_engine/rules?rule_id={rid}")
        status = ("removed" if st in (200, 204)
                  else "not deployed" if st == 404 else f"error ({st})")
        print(f"      {rid}: {status}")

    print("\n[2/4] ML jobs")
    print(f"      command job {ml.teardown(es)}: removed")
    print(f"      telemetry jobs: {telemetry_ml.teardown(es)} removed")

    print("\n[3/4] Demo data (pipeline_source DEFCON lanes)")
    print(f"      deleted {payloads.teardown_data(es)} docs")

    print("\n[4/4] Reference lookups — core ref-hazardous-command preserved (shared)")
    print("      core partitions and shared lookup untouched")

    print("\nTeardown complete.\n")
    return 0


def main():
    p = argparse.ArgumentParser(description="DEFCON PiSat cluster configuration")
    p.add_argument("--config-only", action="store_true", help="deploy without seeding demo data")
    p.add_argument("--teardown", action="store_true", help="remove everything this script created")
    a = p.parse_args()
    if a.teardown:
        return teardown()
    return deploy(seed=not a.config_only)


if __name__ == "__main__":
    raise SystemExit(main())
