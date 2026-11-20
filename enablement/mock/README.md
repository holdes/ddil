# DDIL kit practice mock

A practice copy of the DDIL demo frontend for Elastic SAs. It runs from disk with no kit, no backend and no network. Use it to rehearse the three in-scope adventures, learn the click path, hit the timing, and practise recovering from the failures the real kit has.

Source of truth for every number, prompt and caveat: `../FACTS.md`.

## Open it

- Laptop: open `index.html` in Chrome, Edge, Safari or Firefox (`file://.../enablement/mock/index.html`). Nothing to install, no build step.
- iPad: Safari will not run JavaScript from a file in the Files app. Serve the folder from a laptop on the same network (`python3 -m http.server 8080` inside `mock/`) and open `http://<laptop-ip>:8080/` in Safari, or copy the folder into an offline web-server app on the iPad.
- The folder is self-contained. `brand/` holds copies of the brand tokens, the self-hosted Inter and IBM Plex Mono fonts and the Elastic logo, so the mock still works if you copy `mock/` on its own.
- All scripts are classic `<script>` tags with data in JS globals, so `file://` works in Chrome (ES modules and `fetch` of local JSON are blocked there).

## Share it as one file

`python3 -I tools/build_single.py` writes `dist/ddil-trainer.html` (about 15 MB): every script, style, font, logo, the kit image and all 442 corpus figures in one file. Email it or drop it on a share; it opens from disk with no network. The 100 source PDFs (about 229 MB) are not included, so the document viewer says so; use `dist/ddil-mock.zip` when someone needs the PDFs. Rerun the script after editing anything in `mock/`.

## Controls

| Key or control | Action |
|---|---|
| Right / Left arrow (or PageDown / PageUp) | next / previous step |
| Esc | back to the chooser (blurs a text box first) |
| R | reset the current adventure to step 1 (clears timers, race, agent state and the cached Recent Investigations) |
| C, or the Coach button | toggle the Presenter Coach panel |
| 0 to 5 (SEC only) | jump to chapter 00 to 05, as on the kit |
| Cmd/Ctrl + Enter (SEC chapter 04) | send the agent question |
| Pace selector | Kit pace replays agent streams at realistic speed; 4x pace compresses them for quick run-throughs. The race always runs in real time (15 s GPU, 55 s CPU). |
| Drill selector | injects a real kit failure (see below) |
| Bottom segments | one per step: blue is the current step, teal is a step you marked rehearsed |

Every step has a URL, so you can bookmark or share a step: `index.html#vineyard/5`, `#sec/4`, `#jina/2`. Optional hash parameters: `coach=1|0`, `drill=none|llm|search|es`, `pace=kit|fast`, plus screen helpers used for screenshots (`race=mid|end`, `block=BLK-C`, `mode=potassium`, `q=<example index>`, `run=end`).

## Presenter Coach

For the current step the coach panel shows:

- what to say, in order;
- the proof point to land;
- a LIVE, STAGED or MIXED badge, with the honest phrasing for anything staged or mislabelled on the kit;
- likely questions with short answers;
- what to do if the step fails on the real kit;
- when a drill is on, what you will see and how to recover;
- a "Mark this step rehearsed" button. Progress is stored in this browser's localStorage (wrapped in try/catch, so private mode simply forgets it). Clear it from the chooser.

With the coach on, staged screens also carry a yellow badge in the page itself (for example "Staged visualization" on the race).

## Practice mode

The top bar shows a step timer and a total timer against target times. Targets are suggestions that add up to the 5 to 10 minute demo the kit was built for: Vineyard 9:15, SEC 9:45, Multimodal 8:15. The timer turns pink when you run over.

## Failure drills

| Drill | Vineyard | SEC | Multimodal |
|---|---|---|---|
| LLM timeout | Phase 1 never completes; after 120 s the stream closes with no completion and the screen stays "running" (F6) | Chapter 04 spinner with no events, forever (F9) | Hits and figures appear; the answer fails after 120 s |
| Search fallback | Dashboard, Map and Phase 0 show staged numbers with no error; Phase 0 shows BLK-C mock values (F1, F4) | Chapter 03 returns 502 "Query embed failed" (F3) | Jina embed server down: every search errors |
| ES down | Same silent fallback; Phase 1 shows the two mock matches | Sector chips missing, search 500, agent tool calls fail | Search errors; persona cards still render |

Drills apply to the next action you take (a running stream keeps its original behaviour).

## What each adventure covers and how it maps to the kit

### Vineyard Intelligence (9 steps)

Same order as `demo/frontend/src/App.tsx`: Architecture, Race Intro, Indexing Race (auto-starts), then the main app with the sidebar Dashboard, Vineyard, AI Agronomist, Search, Crop Health, Indexing Race, System. Step 9 is the System screen and Reset Demo.

- Race: replays `demo/backend/app/services/indexer.py` and `metrics.py` exactly: 841,536 docs, ticks every 500 ms, GPU 28,500 v/s target, 48 ms merge, 15 s; CPU 4,200 v/s, 340 ms merge, 55 s; throughput = target x ramp x gauss(1, 0.05); final throughput = docs / elapsed; recall hardcoded 98.9 / 98.7; summary speedup about 3.7x. The CPU card's "Port 9201" and "GPU Util 0%" are copied from the kit on purpose.
- Dashboard and Map: the staged fallback values from `Dashboard.tsx` and `VineyardMap.tsx` (these are what the kit shows when ES is unreachable; live values on a healthy kit will differ). Alerts are the four hardcoded alerts. Quick Investigate prompts are verbatim.
- AI Agronomist: replays the five-phase SSE stream from `routers/chat.py`, including its progress messages, heartbeats every 3 s, and the "in parallel" line even though the phases run one after another. Kit pace takes about 80 s; on the kit budget 1.5 to 3 minutes per question (four sequential Nemotron 3.5 Lightning calls, 120 s cap each, about 8 minutes worst case). Block cards, map and alerts pass a block id. Typed questions and chips do not, so Phase 0 uses the latest block; the mock fixes that to BLK-F so you see the effect (F8). Completed runs are cached under Recent Investigations, like the kit.
- Search and Crop Health: return the same canned results the kit returns today.

### SEC Findings (8 steps)

The eight chapters of `components/sec/SecDeck.tsx`: 00 Setup, 01 Speed, 02 Side-by-Side, Elastic segue, 03 Interface, 04 Agentic, Workflows segue, 05 The Stack. Chapter chips, arrows, digits 0 to 5 and Esc behave as on the kit.

- 00 Setup shows the kit's two nodes racing: DGX Spark (GB10, es-gpu) against Framework Desktop (Ryzen AI Max+ 395, es-cpu), one Elasticsearch 9.5.6 cluster, same index. No cloud instances, no hourly prices.
- 01 Speed uses the same race replay; the headline row shows ingest, force merge and end to end speedups from the staged race, where the job ran (the kit), cloud bill (none) and recall. No dollar figures.
- 02 replaces the economics with kit facts: inference and embeddings run on the DGX Spark, no per-hour or per-token bill, nothing leaves the case, plus the two race durations.
- 03 search returns mock hits for the five example queries with illustrative sector counts summing to 503. Snippets are placeholders, never filing text. The code panel reproduces the kit's request body, with the query vector shown as a 768-d Jina Embeddings v5 Omni placeholder.
- 04 replays an Agent Builder run per example question: reasoning, tool calls with the real tool names (`finance.compare_companies`, `finance.sector_breakdown`, `platform.core.search` and so on), results and a cited answer. Answers are labelled as mock wording; accession ids are `acc-mock-*`.
- Workflows shows the YAML; its links reproduce the kit's 404.

### Multimodal + Need-to-Know (6 steps)

Scenes follow the kit's newer local work: Search by Image, Vector Search, AI Analyst. Steps: 1 Search by Image, 2 Vector Search as Public User, 3 switch to Analyst A then B with the same query and open a PDF, 4 Senior Analyst, 5 AI Analyst answer, 6 wrap.

- **Real corpus.** 100 real open-access papers from the kit's own `pmc-unstructured` source (`hires_chunks.jsonl`, `hires_images.jsonl`): 4,894 text chunks, 442 figures, 240 MB of PDFs, 54 journals. Only CC BY and CC0 papers are included (no NC or ND), each with figures and a source PDF. `data/corpus-manifest.json` lists every paper with title, journal, year, licence and PMC id for attribution.
- **Real markings.** Every paper carries the marking it has on the kit: `tools/pack_corpus.py` imports `assign_markings` from `demo/scripts/jina/markings.py`. Persona rules are ported exactly from `demo/backend/app/services/jina_dls.py` (level hierarchy, all-compartments subset rule via terms_set, NOFORN exclusion for non-US). The query panel shows the request body the backend sends, with the analyst's DLS clauses highlighted.
- **Mock accessible counts (real for the subset):** Public 43 / 100, Analyst A 83, Analyst B 98, Senior Analyst 100. On the kit (198 papers): 85, 163, 187, 198.
- **Vector Search** mirrors the original Jina "Need-to-Know Hybrid Search" UI: analyst bar, search and chips, accessible-corpus meter, live query panel, facets (classification, compartments, source type, journal, year), figure strip, result cards with marking badges, section, page, highlighted snippet and figure thumbnail. Clicking a card, figure or citation opens a slide-over viewer with the real PDF at the matching page, the marking badges and the licence attribution. Esc closes the viewer first.
- **Search is honest about itself.** Practice retrieval is keyword BM25 in your browser over the real corpus. On the kit, Elasticsearch fuses BM25 with Jina kNN (RRF), so semantic matches with no shared words also appear. The DLS pre-filter runs before scoring, results collapse to the best chunk per paper (the kit collapses on parent_id), top 8. A short stopword list and plural folding help keyword recall. Queries take under 2 ms; the index builds once in about 200 ms.
- **AI Analyst** is extractive: it quotes the best sentence containing the query's most specific term from the top DLS-visible papers, with `[PMCxxxx]` citations that open the viewer. If no visible passage qualifies it returns the kit's no-answer text. On the kit Nemotron 3.5 Lightning writes the answer from the same DLS-visible passages.
- **Facets** in the mock count the matching accessible papers when a query is set (the accessible corpus when it is empty). On the kit the facets always count the accessible corpus regardless of the query.

Chips (each checked per persona):

| Chip | Public | Analyst A | Analyst B | Senior |
|---|---|---|---|---|
| malaria infection | 17 matches, no malaria paper | CUI malaria and dengue study on top | adds TS splenic infarction case | same as B |
| radiation therapy brain white matter | U radiotherapy/imaging papers | CUI white-matter paper on top | S radiation demyelination paper on top | same as B |
| hepatic tumor diagnosis | U papers | U/CUI | S paper enters top 2 | TS (TK) hepatic tumour paper on top |
| children dental development | U dental papers | CUI saliva study on top | TS dental papers on top | same as B |
| genetic basis of disease | U papers | CUI and C genetics papers on top | same as A | same as A |
| gut microbiome and immunity | U papers | CUI probiotics paper on top | same as A | same as A |

Chip changes against the kit and the original UI: kept "genetic basis of disease" (original UI) and "gut microbiome and immunity" (kit). Replaced, because the subset has little or no matching text under BM25: "satellite imagery and terrain analysis", "machine learning for medical image analysis", "signal processing techniques", "soil and environmental monitoring" (original UI) and "CRISPR off-target effects", "single-cell RNA sequencing methods", "imaging techniques for early tumor detection" (kit). New: "malaria infection", "radiation therapy brain white matter", "hepatic tumor diagnosis", "children dental development". AI Analyst questions keep "What do these papers say about hypoxia in tumors?" and "What is known about gut microbiome and immunity?" from the kit, and add "What complications does malaria infection cause?" (Public gets the no-answer; Analyst A cites the CUI study) and "What causes bone loss in aging?" (Senior adds a TS paper).

### Corpus media and the build script

```
python3 -I tools/pack_corpus.py          # writes js/data-corpus.js, data/corpus-manifest.json, data/pdfs/, data/figs/
python3 -I tools/pack_corpus.py --zip    # also writes dist/ddil-mock.zip (about 264 MB, media included) for SAs
python3 -I tools/pack_corpus.py --no-media
```

- Source (read-only): `/Users/bholden/Desktop/Jina/demo-multimodal/scale/` (override with `--src`). Stdlib only; uses macOS `sips` to resize figures to 480 px JPEG.
- Selection: CC BY / CC0, has usable figures (publisher badges and slivers are skipped) and a PDF; smallest PDFs first, at most 4 papers per journal.
- `data/pdfs/`, `data/figs/` and `dist/` are gitignored (`mock/.gitignore`) because the repo is public. `js/data-corpus.js` (about 4.8 MB of CC BY text plus markings) is committed so the search works from a clean clone; without media the figure tiles and the viewer show "run tools/pack_corpus.py".
- Hand SAs `dist/ddil-mock.zip`: unzip, open `ddil-mock/index.html`.

## Simplifications

- No backend, no Elasticsearch, no model. Every result is canned and deterministic (seeded random numbers for the race).
- The vineyard map is SVG polygons with no tiles. The kit uses Leaflet with offline CartoDB tiles.
- Kibana buttons and external links show a note instead of opening anything.
- Charts are simple SVG lines, not Recharts. Animations are lighter than the kit's.
- SEC presenter tabs, the tradeoff modal and the config card are condensed.
- Visual design follows the new brand (navy ground, teal, blue, pink, yellow, mono eyebrows, square corners). Screen order, labels, prompts and controls follow the kit so practice transfers.
- Edge Federation (CCS) and the satellite demos are out of scope.
- Multimodal: no kNN leg, no RRF, extractive answers; Search by Image still uses SVG shapes. The committed kit UI has the scenes "Search by Image" and "Need-to-Know"; the mock uses the newer local scene names "Vector Search" and "AI Analyst".

## Files

| Path | Purpose |
|---|---|
| `index.html` | entry point |
| `css/mock.css` | layout and components |
| `brand/` | copied brand tokens, fonts and logos |
| `js/util.js` | seeded PRNG, formatters, safe storage, timers, sparkline |
| `js/race.js` | staged race replay |
| `js/data-*.js` | canned data plus the coach script for each adventure |
| `js/data-corpus.js` | GENERATED: 100-paper corpus subset (metadata, markings, chunk text, figure list) |
| `js/corpus-search.js` | browser BM25, DLS filter, facets, figure strip, extractive analyst |
| `tools/pack_corpus.py` | builds the corpus file, copies media, optional zip |
| `data/corpus-manifest.json` | selection and attribution |
| `data/pdfs/`, `data/figs/` | media (gitignored, created by the packer) |
| `js/screens-*.js` | screens for each adventure |
| `js/app.js` | router, practice bar, coach panel, drills, checklist, keyboard |
| `shots/` | reference screenshots from headless Chrome |
