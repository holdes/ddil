# DDIL SA Enablement

Training, documentation, practice environment and presentation material for the
DDIL kit demos in scope: **Vineyard Intelligence (Agent Builder)**, **SEC Findings**
and **Multimodal + Need-to-Know (DLS)**. Satellite and CCS are out of scope.

Built on branch `sa-enablement` in a separate worktree so it merges cleanly over
the demo-flow work happening on the kit.

| Path | What | Open |
|---|---|---|
| `FACTS.md` | Single source of truth. Every number cites code and is marked MEASURED, STAGED or DOC-ONLY. Every other file draws from it. | n/a |
| `brand/` | Self-hosted Inter + IBM Plex Mono, current Elastic logos, `tokens.css` (light deck palette, dark app palette). Airgap safe. | n/a |
| `docs/` | SA training guide, architecture guide, kit configuration runbook, three scenario runbooks, quick-reference card. Branded HTML, rendered to PDF. | `docs/pdf/` |
| `setup/` | Physical setup guide: out of the case to powered on in seven steps, indicator timeline, pack-down. Interactive figure viewer with hotspots, checklists and fill-in blanks; single-file and PDF editions. | `setup/index.html` |
| `deck/` | Presentation deck in the house HTML style (iso figures, speaker notes). Instructor and share builds. | `deck/*.html` |
| `mock/` | Practice environment. Plain HTML/JS, no backend, opens from disk. Scripted versions of all three adventures with a presenter coach. | `mock/index.html` |
| `tools/` | `elastic-iso-diagrams` renderer used by the deck and mock. | n/a |

Demo app facelift lives in place under `demo/frontend/` (theme layer + chooser).
See `FACELIFT.md` for exactly which files changed and why.

## Rules for everything in here

- No figure without a `FACTS.md` entry. Staged numbers are labelled staged when an SA reads them.
- Declarative voice. No em dashes. No customer names.
- Nothing loads from the internet at runtime. Fonts, logos and libraries are local.
