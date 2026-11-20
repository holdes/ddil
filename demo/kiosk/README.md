# DDIL Kiosk · Sovereign AI shell

A standalone display app for the 7.84″ 1280×400 DeskPi touchscreen mounted in
the DDIL Pelican rack. It's the **always-on shell** for the kit — branding,
system health, machine telemetry, easter egg — separate from whichever demo
runtime the kit is currently hosting (the main demo runs on the tablet/PC).
Public-facing messaging is **Sovereign AI · Context Engineering Anywhere**.

Designed to run on the Framework Desktop in Chromium kiosk mode (no GUI),
but fully self-contained for laptop dev.

> **Panel quirk to know:** the DeskPi advertises itself as "RTK FHD" 1920×1080
> over its EDID — its physical pixels are actually 1280×400. Linux + `xrandr`
> can force the real native modeline (the deploy script does this). macOS
> can't easily, so for design QA on a Mac, **use Chrome DevTools at 1280×400**
> rather than dragging Chrome to the panel.

## Modes

| Mode | What it does |
|---|---|
| **Boot Diagnostics** | Animated startup sequence — pings ES-GPU, ES-CPU, Ollama (LLM + embed), backend, and the sensor bus. Matrix-style log on the right, branded checklist on the left. Auto-advances to Idle on completion. |
| **Idle** | A 2-page swipeable carousel. **Page 1 — Branding:** Elastic ↔ DGX Spark identity flanking a QR code that links to elastic.co/geospatial, plus a stack-capabilities ticker. **Page 2 — Diagnostics:** live (mock) telemetry for the Framework Desktop and DGX Spark — CPU, GPU, RAM/VRAM, temp, uptime — plus network/display info. Swipe horizontally on the touchscreen, ◂/▸ buttons under the page dots, or arrow keys. |
| **Easter Egg — ARCADE** *(hidden)* | A hidden games chooser with two titles: **INDEXER** (an Elastic-themed snake — eat documents, grow your index, don't bite your shards) and **RALLY** (GPU-vs-CPU pong, 1P or 2P). **Triggered by tapping either brand logo (Elastic or NVIDIA) on the idle Branding page 5 times within 3 seconds.** Pick a card to play; `ESC` (or the ESC ✕ button) backs a game out to the chooser, then the chooser to Idle. Dev hotkeys: `3` opens the chooser, `4` jumps straight into RALLY. Full detail: **`ARCADE.md`**. |

## Dev (on a laptop)

```bash
cd demo/kiosk
npm install
npm run dev          # http://localhost:3100
# add ?dev=1 to show the cursor
```

**Mode controls:** the **MODE ▸** button in the top-right cycles between **Boot** and **Idle** (the public-facing modes). Dev hotkeys: `1` → Boot, `2` → Idle, `3` → ARCADE chooser, `4` → RALLY directly (hidden easter eggs). `ESC` backs a game out to the chooser, then the chooser to Idle.

**Inside Idle:** swipe left/right on the touchscreen, tap the ◂ / ▸ buttons next to the page dots, or use `←` / `→` to switch between the Branding and Diagnostics pages.

The stage is always rendered at 1280×400 and CSS-scaled to fit the window — drag the
browser to the touchscreen and fullscreen it (⌃⌘F on Mac) to see it at native size.

## Switching mock → real data

`src/lib/health.ts` defaults to `MOCK = true` and synthesizes plausible latencies. Once
the Framework Desktop has the backend running and can reach the DGX Spark:

1. Set `MOCK = false` in `src/lib/health.ts`
2. Endpoints are already wired to `http://192.168.1.20:9200/9201/11434` and `/api/...`
3. The Vite dev proxy forwards `/api` → `http://localhost:8001`

## Deploying to the Framework Desktop

There's a one-shot installer in `deploy/`. From the Framework (fresh Ubuntu Server 24.04, no GUI):

```bash
cd demo/kiosk
npm install
npm run build
sudo ./deploy/install.sh
```

That installs minimal X11 + Chromium, creates a `ddil` user, syncs `dist/` to `/opt/ddil-kiosk/`, and enables two systemd units:
- **`ddil-kiosk-server`** — serves `dist/` on `127.0.0.1:3100` via Python's stdlib http.server.
- **`ddil-kiosk`** — owns tty7, runs `startx` with `kiosk-launch.sh` which registers a 1280×400 xrandr modeline (CVT-generated), maps touch input to the HDMI output, kills screen blanking, hides cursor, then launches Chromium in `--kiosk --app=...` mode at native dimensions.

To update after edits: `npm run build && sudo ./deploy/install.sh` (idempotent). For a code-only restart: `sudo systemctl restart ddil-kiosk`. Live logs: `journalctl -u ddil-kiosk -f`.

Full deploy guide including troubleshooting (wrong output name, modeline rejection, touch calibration, modeline tuning): **`deploy/DEPLOY.md`**.

## Layout notes

- The screen is **3.2:1 aspect ratio** — almost everything is laid out as 2 or 3 horizontal
  columns (`grid-cols-[440px_1fr]`, `grid-cols-[1fr_1.4fr_1fr]`, etc.).
- Top **28px** is reserved for the persistent status bar. The mode container uses
  `top-7` (not `pt-7`) — absolute-positioned children inside ignore parent padding,
  so explicit `top-7` is what actually pushes them below the status bar.
- Page indicator (idle carousel) is tucked into the **bottom-right corner** so it never
  overlays page content (the Branding marquee, the Diagnostics Kv strip).
- The snake game canvas is sized **60 cols × 18 rows × 18px = 1080×324px** to fit
  inside its 1100px grid cell (1280 - 180px side panel).
- Tailwind brand-color theme tokens live in `src/styles.css`:
  `elastic-pink`, `elastic-yellow`, `elastic-teal`, `elastic-blue`, `nvidia-green`.
  Use the literal names — Tailwind's JIT can't resolve `text-${color}` interpolations.
- `cursor: none` is set globally — append `?dev=1` to the URL to bring the cursor back.

## Diagnostic HUD

A small overlay (`src/components/DebugHud.tsx`) shows the live viewport, scale,
device pixel ratio, and how much letterboxing is happening. Toggle it any time
with the **`** (backtick) key, or load with `?debug=1`. Useful when the design
looks wrong on an unfamiliar display — almost always a viewport-size mismatch,
not a layout bug.

## File map

```
demo/kiosk/
├── index.html                          viewport locked to 1280, hides cursor
├── README.md                           (you are here)
├── public/
│   ├── elastic-mark.svg                petals only (square)
│   ├── elastic-horizontal.svg          official horizontal lockup (light bg)
│   ├── elastic-horizontal-dark.svg     same, retuned for dark surfaces
│   ├── elastic-logo.svg                favicon (= mark)
│   ├── nvidia-mark.svg                 green eye only
│   └── nvidia-vertical.svg             eye + NVIDIA wordmark stacked (white wordmark)
├── src/
│   ├── main.tsx
│   ├── App.tsx                         mode router + secret-trigger + DebugHud mount
│   ├── styles.css                      tailwind + brand tokens + scanlines
│   ├── vite-env.d.ts                   declares *.css module type
│   ├── lib/
│   │   ├── health.ts                   service probes + ASCII banner (MOCK toggle)
│   │   └── useScale.ts                 fits the 1280×400 stage to the viewport
│   ├── components/
│   │   ├── StatusBar.tsx               always-on top strip
│   │   ├── ElasticLogo.tsx             <ElasticLogo variant="mark"|"horizontal" />
│   │   ├── NvidiaLogo.tsx              <NvidiaLogo variant="mark"|"vertical" />
│   │   ├── SecretTap.tsx               N-taps-in-Tms gesture (easter egg trigger)
│   │   └── DebugHud.tsx                overlay shown via ?debug=1 or backtick
│   └── modes/
│       ├── BootDiagnostics.tsx         animated probe sequence
│       ├── EasterEgg.tsx               the snake game ("INDEXER")
│       ├── IdleBranding.tsx            2-page swipe carousel + bottom-right page dots
│       └── idle/
│           ├── BrandingPage.tsx        Elastic + centered QR + ticker + NVIDIA
│           └── DiagnosticsPage.tsx     Framework + DGX Spark hardware + telemetry
└── deploy/
    ├── DEPLOY.md                       step-by-step deploy guide + troubleshooting
    ├── install.sh                      one-shot installer (run as root on Framework)
    ├── kiosk-launch.sh                 X session entry: xrandr modeline + Chromium
    ├── ddil-kiosk-server.service       static server (python http.server on :3100)
    └── ddil-kiosk.service              X kiosk session (startx + Chromium on tty7)
```
