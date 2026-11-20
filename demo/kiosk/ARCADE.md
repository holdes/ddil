# Kiosk Arcade — hidden easter-egg games

The kiosk shell (`demo/kiosk/`, the 1280×400 Sovereign-AI display — **not** the
`:3000` adventure app) hides two throwaway games behind a discoverable gesture.
This note documents how they're wired so the next person doesn't re-reverse-engineer it.

> Scope: the mode routing lives in `src/App.tsx`; the games are
> `src/modes/EasterEgg.tsx` (INDEXER) and `src/modes/Pong.tsx` (RALLY); the
> chooser is `src/modes/Arcade.tsx`; the unlock gesture is
> `src/components/SecretTap.tsx` mounted inside `src/modes/idle/BrandingPage.tsx`.

## How you reach it

1. On the **Idle → Branding** page, tap **either brand logo** — the Elastic
   horizontal lockup (left) or the NVIDIA vertical lockup (right) — **5 times
   within 3 seconds**. Both are `SecretTap` targets (`taps={5} windowMs={3000}`).
   The Elastic logo on the left is the reliable one on the physical touch panel.
2. That fires `onSecretUnlock` → App switches to the **ARCADE** chooser.
3. Pick a card (tap, or ◂ ▸ highlight + ENTER) to launch a game.
4. **ESC** (or the on-screen `ESC ✕`) backs a game out to the chooser, and the
   chooser out to Idle. The public **MODE ▸** button also drops you straight
   back to Idle from any hidden mode.

**Dev hotkeys** (App-level, see `App.tsx`): `1` → Boot, `2` → Idle,
`3` → ARCADE chooser, `4` → jump straight into RALLY. Mode enum is
`'boot' | 'idle' | 'arcade' | 'game' | 'pong'`; only `boot`/`idle` are in
`PUBLIC_MODES` (what the MODE button cycles).

## The two games

| Card | Mode | Theme | What it is |
|---|---|---|---|
| **INDEXER** | `game` | *an elastic classic* — "eat the documents · grow the index" | Elastic-themed snake. Eat documents, grow your index, don't bite your own shards. Canvas 1080×324 (60×18 × 18px) to fit the 1fr\|180px layout. |
| **RALLY** | `pong` | *an nvidia + elastic classic* — "GPU vs CPU · don't drop the stream" | Pong that leans into the kit's GPU-vs-CPU race story. **GPU paddle** (nvidia-green, left) vs **CPU paddle** (elastic-blue, right), yellow ball. |

### RALLY specifics (`Pong.tsx`)

- **1P (vs AI)** and **2P (head-to-head)** — selectable; `players` state `1 | 2`.
- **Controls:** P1 = `W`/`S`, P2 = `↑`/`↓`. In 1P the left paddle accepts both
  key pairs; the right paddle is AI.
- **First to 7** (`WIN_SCORE`). Ball serves at `BASE_SPEED` 5.2 px/tick, caps at
  `MAX_SPEED` 11 so it stays catchable on the touchscreen.
- The AI paddle is deliberately capped (`CPU_SPEED` 4.4 < `PADDLE_SPEED` 7) — the
  "CPU grinds" so the GPU side can win, mirroring the indexing-race narrative.
- Playfield is 1080×324 to match the snake canvas footprint so the shared
  `1fr | 180px` side-panel layout lines up.

## Why a chooser instead of two tap targets

Originally each game was going to hang off its own logo tap. The physical touch
panel is only reliable on the **left** half, so a second (right-side) tap target
was effectively unreachable. Both logos now funnel through **one** gesture into
an on-screen **ARCADE** menu instead — see the comment block atop `Arcade.tsx`.

## History

- `7891f37` — added PONG easter egg on the NVIDIA logo (5 taps).
- `3471d1b` — added the ARCADE chooser, renamed PONG → **RALLY**, added 2-player
  mode. (Both pushed to `origin/master` 2026-11-20.)
