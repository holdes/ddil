# Demo frontend brand facelift

Branch `sa-enablement` (worktree `~/Desktop/ddil-enablement`, based on `holdes/master` 5114c3a). Not committed.

## What changed

The facelift lives in the theme layer plus one screen. No flow component was edited.

1. **Palette remap (global).** A new `src/theme.css` overrides Tailwind v4 colour tokens inside `@theme`. Every existing utility class (`bg-slate-950`, `text-emerald-400`, `border-blue-500/20`, ...) now resolves to the Elastic brand palette. Each ramp is monotonic (50 lightest, 950 darkest), so opacity modifiers and light/dark pairings behave as before.
2. **Fonts.** Inter (300 to 700) and IBM Plex Mono (400 to 700) are self-hosted from `public/fonts/` with `@font-face`. `--font-sans` and `--font-mono` point at them, so `font-mono` across the app is now Plex Mono. Weights 800/900 map to the 700 file to avoid synthetic bold. Nothing loads from Google Fonts.
3. **Corners.** `--radius-xs` to `--radius-4xl` are reduced (lg 8px→4px, xl 12px→6px, 2xl 16px→8px, and so on). `rounded-full` is unchanged, so status dots stay round.
4. **Base layer.** `html`/`body` get the navy ground, `color-scheme: dark`, Inter, and antialiasing. Brand-blue `:focus-visible` ring, blue `::selection`, and thin navy scrollbars.
5. **Brand tokens.** `--color-elastic` changed from #00BFB3 to #02BCB7 and `--color-elastic-dark` from #017D77 to #0B7A7E. New `--color-brand-*` tokens were added (ground, paper, raised, line, blue, blue-light, teal, teal-mid, pink, yellow, poppy, midnight). `--color-nvidia` (#76B900) is unchanged.
6. **index.css.** This was the leftover Vite starter stylesheet: `#root` 1126px wide, centred text, `color-scheme: light dark`, and `h1`/`h2` margins. `main.tsx` never imported it, so it had no effect, but importing it would break the full-bleed layout. Its contents are now a comment explaining that. The app did not depend on any of it.
7. **Adventure Chooser redesign** in the house style:
   - A mono uppercase eyebrow with a blue square.
   - The headline "Choose your adventure. / No cloud required.", with the second half in brand blue.
   - Four cards with 1px borders, square corners, a 12px offset shadow tinted with each card's accent, a mono index and kicker, mono stat lines, and a mono "Start demo" CTA.
   - The current Elastic horizontal logo (white), cropped in place. No wordmark text is set next to it.
   - A blueprint grid background.
   - A slowly floating figure of the real kit: the background-removed front rendering from the setup guide (`enablement/setup/img/front.webp`, downscaled to 440 px wide as `kit-front.webp` and imported as a Vite asset, so it is bundled and loads nothing from the network). The rendering was made for light pages, so on the navy ground it gets a 1px light edge glow and a soft dark drop shadow to separate its outline from the background. A mono caption "The kit · front" sits under it. This replaced an earlier isometric figure (`kit-iso.svg` from `kit-iso.scene.json`), which did not represent the kit and was removed.
   - Props and `onChoose` values (`"vineyard" | "sec" | "jina" | "ccs"`) are unchanged, so `App.tsx` was not touched.
8. **Card copy corrected against FACTS.md:**
   - **Vineyard.** "869K sensor records" became "841,536 soil sensor readings" plus "869K docs across 5 indices" (C2). The Agent Builder claim was removed: the agronomist is described as "5 phases · kNN + Nemotron 3.5 Lightning" (C10, §2.4; showcase lineup, FACTS §0). "22 acres" became "six-block" (C24). The 17K disease images line was dropped because imagery is not loaded by the bulk script and the scanner is canned (§2.2, §2.7).
   - **SEC.** The card no longer mentions 10-Q filings, which do not exist in the index. It now says the Agent Builder finance analyst uses 10 tools, ES|QL tools among them (§3.3).
   - **Multimodal.** The "509 papers" figure was removed because it is STAGED and conflicts with 208 in the local WIP (C21). "Document-level security enforces" became "clearance filter": the filter is applied by the app, not by native ES DLS (§4.3). The copy is worded so it stays true after the local WIP drops the Search by Image scene.
   - **Edge Federation.** The direction now matches the code: the box is the CCS coordinator, dials out to Elastic Cloud, and is outbound only (C26). Synchronise Now is attributed to HQ, because the iPad screen is collection only and the button lives in `hq-console`.
   - **Footer.** "Fully Airgapped" became "Airgapped by default", because the CCS adventure uses an uplink.
   - **Showcase lineup (13 Nov 2026).** The footer reads "Elasticsearch 9.5.6 + NVIDIA cuVS · Nemotron 3.5 Lightning + Jina v5 Omni on DGX Spark" and the Multimodal stat reads "Jina v5 Omni". These name the showcase target in FACTS §0, which is STAGED until the kit config matches.
9. **index.html.** The page title changed from "frontend" to "DDIL Demo Kit".

## Files touched

| File | Change |
|---|---|
| `demo/frontend/src/theme.css` | **new**. Palette, fonts, radius, base layer |
| `demo/frontend/src/App.css` | +1 line `@import "./theme.css"` after `@import "tailwindcss"`; 2 values in the existing `@theme` (`--color-elastic`, `--color-elastic-dark`) |
| `demo/frontend/src/index.css` | Vite template replaced with a comment (file was not imported) |
| `demo/frontend/index.html` | `<title>` only |
| `demo/frontend/src/components/AdventureChooser/AdventureChooser.tsx` | rewritten (same export, same props) |
| `demo/frontend/src/components/AdventureChooser/kit-front.webp` | **new**. Front rendering of the kit, 440 px wide, from `enablement/setup/img/front.webp` |
| `demo/frontend/public/fonts/*.woff2` | **new**. 9 files copied from `enablement/brand/fonts/` |
| `demo/frontend/public/logo-elastic-horizontal-white.svg` | **new**. Copied from `enablement/brand/logo/` |

Flow components touched: **none**. That includes AgentChat, Dashboard, VineyardMap, Race*, sec/*, jina/*, ccs/* and Architecture, as well as `App.tsx` and `main.tsx`.

To refresh the figure after the setup-guide rendering changes: `cwebp -q 82 -alpha_q 90 -resize 440 0 enablement/setup/img/front.webp -o demo/frontend/src/components/AdventureChooser/kit-front.webp`.

## Palette mapping

| Tailwind family | Brand target | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|
| slate | Elastic navy + blue-grey text | #B0BBD0 | #98A3BA | #808CA5 | #5E6B8C | #24345F (border) | #16285A (raised) | #101C3F (surface) | #0B1633 (ground) |
| emerald, teal | Elastic teal | #72F2D8 | **#48EFCF** | **#02BCB7** | #0A8F8F | #0B6E72 | #0C5F63 | #0A4A50 | #062C33 |
| blue, sky | Elastic blue | #8FC0FF | **#5B9BFF** | #2B7FF5 | **#0B64DD** | #0A52B3 | #123E8A | #12306A | #0D2147 |
| cyan | Light blue (EUI sky) | #94D8EB | #63C8E3 | #37B8DC | #0DA1C9 | #19799F | #0F658A | #055476 | #003447 |
| amber, yellow | Elastic yellow | #FED54A | **#FEC514** | #FFAD18 | #E08E00 | #B36F05 | #8A5506 | #6A4906 | #3D2A08 |
| rose, pink | Elastic pink | #F99BC4 | #F472AE | **#F04E98** | #DD0A73 | #BC1E70 | #8C1556 | #5E2140 | #351725 |
| violet, purple | Cool blue-violet | #B3ACFF | #9189FA | #7468F0 | #5B4FD9 | #4A3FB5 | #3B3390 | #2F2A70 | #1C1945 |
| red, orange, green, fuchsia, greys | unchanged (red stays semantic danger) | | | | | | | | |

The light steps (slate 50/100/200 are #F5F7FA/#E3E8F2/#C9D3E3) are defined in full in `theme.css`.

Contrast of the text steps on the ground (#0B1633), where the old Tailwind value is measured on old slate-950:

| Step | New contrast | Old contrast |
|---|---|---|
| slate-400 | 7.0:1 | 6.8:1 |
| slate-500 | 5.3:1 | 4.4:1 |
| slate-600 | 3.4:1 | 2.7:1 |

Muted text got slightly more readable. White on `bg-emerald-600` buttons is 3.9:1, against 3.8:1 before.

## Merge notes (vs. the in-flight demo work in `~/Desktop/ddil`)

- **Flow components.** No changes, so the logic, API and scene edits there merge without conflict.
- **`App.css`.** This is the only shared file with real overlap risk. The local WIP appends a `.jina-lite` block at the end of the file (after the `.prose-jina` rules). This branch only changes lines 2 and 7-8, at the top. The hunks are about 10 lines apart, so git merges them automatically. If a conflict appears anyway, keep both sides.
- **The `.jina-lite` light theme (local WIP).** It uses its own `--j-*` CSS variables, so it is unaffected. Its light-mode chips use `text-sky-700`, `text-rose-700`, `text-blue-700`, `text-amber-800` and `bg-slate-100`. All of those remain dark (700/800) or light (100) in the new ramps, so they still read on white. Its `"Inter"` font-family now resolves to the self-hosted Inter. Its `Space Mono` falls back to `ui-monospace` exactly as before, because Space Mono is not shipped. To unify the look, change `--j-mono` to `"IBM Plex Mono"`.
- **`AdventureChooser.tsx`.** Rewritten. The local WIP does not touch it. If someone edits the old file in parallel, take this version and re-apply their copy change.
- **`index.css` and `index.html`.** Neither is touched by the WIP. Both are low risk.
- **Hard-coded hex colours in flow components are not remapped.** Examples are recharts strokes (#10b981, #334155, #f59e0b) and `.prose-jina` (#cbd5e1, #c4b5fd). They are close enough to the new palette that nothing looks broken. Tokenising them would mean editing flow files, so it was left for later.
- **Build.** `npm run build` (`tsc -b && vite build`) **fails at baseline** with 10 TypeScript errors in untouched files: AgentChat, Architecture, Dashboard, LeafScanner, SensorDashboard, VineyardMap and useWebSocket (unused imports, one `unknown` → ReactNode, one hook arity). None of the errors is in a file this facelift touched. `npx vite build` succeeds. The kit runs the Vite dev server, which does not type-check, so the demo is unaffected.

## How to revert

1. `git checkout -- demo/frontend/src/App.css demo/frontend/src/index.css demo/frontend/index.html demo/frontend/src/components/AdventureChooser/AdventureChooser.tsx`
2. Delete `demo/frontend/src/theme.css`, `demo/frontend/src/components/AdventureChooser/kit-front.webp`, `demo/frontend/public/fonts/` and `demo/frontend/public/logo-elastic-horizontal-white.svg`.

For a theme-only revert that keeps the new chooser, delete the `@import "./theme.css"` line in `App.css`. The chooser still renders, but in Tailwind's default colours.

## Screenshots

Taken at 1280×800 in headless Chrome against `vite preview`, with no backend running, so data screens show their staged fallbacks. They are in `enablement/facelift-shots/`:

- 01-chooser
- 10-vineyard-architecture
- 11-vineyard-race-intro
- 12-vineyard-race
- 13-vineyard-dashboard
- 14-vineyard-map
- 15-vineyard-agronomist
- 16-vineyard-search
- 17-vineyard-system
- 20-sec-ch00-setup
- 21-sec-ch01-speed
- 22-sec-ch03-search
- 23-sec-ch04-agent
- 30-jina-first
- 31-jina-need-to-know
- 40-ccs-first

The shots other than 01 were taken before emerald-600 was darkened from #04A09E to #0A8F8F, so teal buttons are one shade darker in the current build.
