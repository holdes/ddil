"""
DEFCON reference data — the hazardous-command catalog is now a CORE artifact.

The DEFCON rules join against `ref-hazardous-command`, which the core project owns
and builds from `payload_generators/config.py::HAZARDOUS_COMMANDS` (see
`cluster_loader/authorized_lookups.py`). It is grounded in cFS app command
semantics, so it covers any cFS spacecraft including pisat — there is no
pisat-specific hazard list to maintain.

This module therefore does NOT create its own `ref-defcon-*` indices. It only
ENSURES the shared core index exists (idempotent), so the DEFCON pack can be
deployed against a cluster that has not yet built the core lookups. Teardown is a
deliberate no-op: the index is core/shared and must survive a DEFCON teardown.
"""

REF_INDEX = "ref-hazardous-command"


def _core_spec():
    """The single source of truth: the core lookup spec + row builder."""
    from cluster_loader.authorized_lookups import LOOKUP_INDICES
    mappings, key, _desc, rows_fn, _rules = LOOKUP_INDICES[REF_INDEX]
    return mappings, key, rows_fn


def ensure(es):
    """(Re)create + populate the shared core `ref-hazardous-command` from core config.
    Idempotent. Grounded in payload_generators/config.py::HAZARDOUS_COMMANDS."""
    mappings, key, rows_fn = _core_spec()
    es.indices.delete(index=REF_INDEX, ignore_unavailable=True)
    es.indices.create(index=REF_INDEX, settings={"index.mode": "lookup"}, mappings=mappings)
    rows = rows_fn()
    for r in rows:
        es.index(index=REF_INDEX, document=r)
    es.indices.refresh(index=REF_INDEX)
    return [(REF_INDEX, key, len(rows))]


# Back-compat alias for the orchestrator's phase name.
build = ensure


def teardown(es):
    """No-op: `ref-hazardous-command` is a CORE/shared index. A DEFCON teardown must
    not remove it — other core rules (sparta-mire7-*) depend on it."""
    return []
