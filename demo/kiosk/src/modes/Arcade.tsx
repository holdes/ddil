import { useEffect, useState, type ReactNode } from 'react'

// The hidden-games chooser. Reached via the secret tap on either brand logo
// (5 taps in 3s). Picking a card launches that game; ESC returns to idle.
// This exists because the kiosk's touch panel is only reliable on the left,
// so both easter eggs now funnel through one gesture + an on-screen menu
// instead of a second (unreachable) tap target on the right.

type GameMode = 'game' | 'pong'

interface GameDef {
  mode: GameMode
  title: string
  sub: string
  tag: string
  accent: string   // title text color
  border: string   // selected border color
  ring: string     // selected ring color
  Visual: () => ReactNode
}

function SnakeViz() {
  const cols = ['#1BA9F5', '#00BFB3', '#F04E98', '#FEC514']
  return (
    <div className="flex items-center gap-1">
      {cols.map((c, i) => (
        <div key={i} className="w-4 h-4 rounded-sm" style={{ background: c }} />
      ))}
      <div className="w-4 h-4 rounded-sm ml-2 border border-black/40" style={{ background: '#FEC514' }} />
    </div>
  )
}

function RallyViz() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-1.5 h-10 rounded-full bg-nvidia-green" />
      <div className="w-3 h-3 rounded-full bg-elastic-yellow shadow shadow-elastic-yellow/50" />
      <div className="w-1.5 h-10 rounded-full bg-elastic-blue" />
    </div>
  )
}

const GAMES: GameDef[] = [
  {
    mode: 'game',
    title: 'INDEXER',
    sub: 'an elastic classic',
    tag: 'eat the documents · grow the index',
    accent: 'text-elastic-yellow',
    border: 'border-elastic-yellow/50',
    ring: 'ring-elastic-yellow/60',
    Visual: SnakeViz,
  },
  {
    mode: 'pong',
    title: 'RALLY',
    sub: 'an nvidia + elastic classic',
    tag: 'GPU vs CPU · don’t drop the stream',
    accent: 'text-nvidia-green',
    border: 'border-nvidia-green/50',
    ring: 'ring-nvidia-green/60',
    Visual: RallyViz,
  },
]

interface ArcadeProps {
  onPick: (mode: GameMode) => void
  onExit: () => void
}

export function Arcade({ onPick, onExit }: ArcadeProps) {
  const [sel, setSel] = useState(0)

  // Keyboard: ◂ ▸ highlight, Enter/Space play, Esc exit. (1/2 are reserved by
  // the App-level dev hotkeys, so we don't bind them here.)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') { setSel(s => (s + 1) % GAMES.length); e.preventDefault() }
      else if (e.key === 'ArrowLeft') { setSel(s => (s - 1 + GAMES.length) % GAMES.length); e.preventDefault() }
      else if (e.key === 'Enter' || e.key === ' ') { onPick(GAMES[sel].mode); e.preventDefault() }
      else if (e.key === 'Escape') { onExit() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel, onPick, onExit])

  return (
    <div className="absolute inset-0 flex flex-col font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-2">
        <div className="text-[10px] uppercase tracking-[0.35em] text-white/40">
          Easter Eggs <span className="text-white/25">·</span> Select a Game
        </div>
        <button
          onClick={onExit}
          className="text-white/40 hover:text-white/80 active:text-white text-[10px] border border-white/10 rounded px-1.5 leading-tight"
          aria-label="exit arcade"
        >
          ESC ✕
        </button>
      </div>

      {/* Two game cards */}
      <div className="flex-1 grid grid-cols-2 gap-4 px-4 py-3">
        {GAMES.map((g, i) => {
          const active = i === sel
          return (
            <button
              key={g.mode}
              onClick={() => onPick(g.mode)}
              onMouseEnter={() => setSel(i)}
              className={`relative rounded-lg border bg-bg-elev flex flex-col items-center justify-center gap-2.5 transition-all ${
                active ? `${g.border} ring-2 ${g.ring}` : 'border-white/10'
              }`}
            >
              <div className={`text-3xl font-bold tracking-widest ${g.accent}`}>{g.title}</div>
              <g.Visual />
              <div className="text-white/55 text-[11px]">{g.tag}</div>
              <div className="text-white/30 text-[9px] uppercase tracking-widest">{g.sub}</div>
              <div
                className={`mt-1 px-3 py-1 rounded border text-[10px] uppercase tracking-widest transition-colors ${
                  active
                    ? 'border-elastic-teal/60 bg-elastic-teal/10 text-elastic-teal'
                    : 'border-white/15 text-white/45'
                }`}
              >
                ▶ Tap to Play
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer hint */}
      <div className="text-center text-white/30 text-[9px] pb-1.5 tracking-widest">
        ◂ ▸ highlight · ENTER to play · ESC to exit
      </div>
    </div>
  )
}
