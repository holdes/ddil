import { useEffect, useRef, useState } from 'react'

// Wide playfield — the screen is 1280x400 (minus the 28px status bar).
// Side panel is 180px, so the playfield cell is 1100px wide. Canvas at
// 60 cols × 18px tiles = 1080px fits comfortably with margin for a border.
const COLS = 60
const ROWS = 18
const TILE = 18

type Cell = { x: number; y: number }
type Dir  = { x: number; y: number }

const DIRS: Record<string, Dir> = {
  ArrowUp:    { x: 0, y: -1 },
  ArrowDown:  { x: 0, y: 1 },
  ArrowLeft:  { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
}

const ELASTIC_COLORS = ['#F04E98', '#FEC514', '#00BFB3', '#1BA9F5']

interface EasterEggProps {
  onExit?: () => void
}

export function EasterEgg({ onExit }: EasterEggProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [best, setBest]   = useState<number>(() =>
    Number(localStorage.getItem('ddil-snake-best') ?? '0'),
  )
  const [running, setRunning] = useState(false)
  const [gameOver, setGameOver] = useState(false)

  // Mutable game state in refs so the loop doesn't restart on each render
  const snake = useRef<Cell[]>([])
  const dir   = useRef<Dir>({ x: 1, y: 0 })
  const queuedDir = useRef<Dir | null>(null)
  const food  = useRef<Cell>({ x: 0, y: 0 })
  const tickRef = useRef<number | null>(null)
  const speed = useRef(110)

  function reset() {
    snake.current = [
      { x: 10, y: 9 }, { x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 },
    ]
    dir.current = { x: 1, y: 0 }
    queuedDir.current = null
    placeFood()
    setScore(0)
    setGameOver(false)
    speed.current = 110
  }

  function placeFood() {
    while (true) {
      const c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
      if (!snake.current.some(s => s.x === c.x && s.y === c.y)) {
        food.current = c
        return
      }
    }
  }

  function tick() {
    if (queuedDir.current) {
      const q = queuedDir.current
      // prevent reversing into self
      if (!(q.x === -dir.current.x && q.y === -dir.current.y)) dir.current = q
      queuedDir.current = null
    }
    const head = snake.current[0]
    const next = { x: head.x + dir.current.x, y: head.y + dir.current.y }
    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) return die()
    if (snake.current.some(s => s.x === next.x && s.y === next.y)) return die()
    snake.current.unshift(next)
    if (next.x === food.current.x && next.y === food.current.y) {
      setScore(s => s + 1)
      placeFood()
      speed.current = Math.max(55, speed.current - 2)
    } else {
      snake.current.pop()
    }
    draw()
    tickRef.current = window.setTimeout(tick, speed.current)
  }

  function die() {
    setGameOver(true)
    setRunning(false)
    setBest(prev => {
      const next = Math.max(prev, score)
      localStorage.setItem('ddil-snake-best', String(next))
      return next
    })
    if (tickRef.current) clearTimeout(tickRef.current)
  }

  function draw() {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0b0d12'
    ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE)

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 1
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i * TILE + 0.5, 0); ctx.lineTo(i * TILE + 0.5, ROWS * TILE); ctx.stroke()
    }
    for (let i = 0; i <= ROWS; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * TILE + 0.5); ctx.lineTo(COLS * TILE, i * TILE + 0.5); ctx.stroke()
    }

    // Food = "document"
    const f = food.current
    ctx.fillStyle = '#FEC514'
    ctx.fillRect(f.x * TILE + 3, f.y * TILE + 2, TILE - 6, TILE - 4)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(f.x * TILE + 5, f.y * TILE + 6 + i * 3, TILE - 10, 1)
    }

    // Snake = elastic logo color cycling
    snake.current.forEach((s, i) => {
      const color = i === 0 ? '#1BA9F5' : ELASTIC_COLORS[i % ELASTIC_COLORS.length]
      ctx.fillStyle = color
      ctx.fillRect(s.x * TILE + 1, s.y * TILE + 1, TILE - 2, TILE - 2)
      if (i === 0) {
        // eye dot
        ctx.fillStyle = '#0b0d12'
        const ex = s.x * TILE + TILE / 2 + dir.current.x * 4
        const ey = s.y * TILE + TILE / 2 + dir.current.y * 4
        ctx.fillRect(ex - 1, ey - 1, 3, 3)
      }
    })
  }

  function start() {
    if (running) return
    reset()
    setRunning(true)
    if (tickRef.current) clearTimeout(tickRef.current)
    tickRef.current = window.setTimeout(tick, speed.current)
  }

  // Initial paint
  useEffect(() => {
    reset()
    draw()
    return () => { if (tickRef.current) clearTimeout(tickRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keyboard controls
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (DIRS[e.key]) { queuedDir.current = DIRS[e.key]; e.preventDefault() }
      else if (e.key === ' ' || e.key === 'Enter') { start() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  // Touch swipe controls
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return
    if (Math.abs(dx) > Math.abs(dy)) {
      queuedDir.current = dx > 0 ? DIRS.ArrowRight : DIRS.ArrowLeft
    } else {
      queuedDir.current = dy > 0 ? DIRS.ArrowDown : DIRS.ArrowUp
    }
    touchStart.current = null
  }

  return (
    <div
      className="absolute inset-0 grid grid-cols-[1fr_180px] gap-0"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Playfield */}
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={COLS * TILE}
          height={ROWS * TILE}
          className="block rounded border border-white/10"
        />
        {!running && !gameOver && (
          <Overlay title="INDEXER" subtitle="eat the documents · grow the index" cta="TAP / SPACE TO START" onClick={start} />
        )}
        {gameOver && (
          <Overlay title="SHARD FAILURE" subtitle={`indexed ${score} documents`} cta="TAP / SPACE FOR RETRY" onClick={start} />
        )}
      </div>

      {/* Side panel */}
      <div className="border-l border-white/5 bg-bg-elev p-3 flex flex-col font-mono">
        <div className="flex items-start justify-between mb-2">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Easter Egg</div>
          {onExit && (
            <button
              onClick={onExit}
              className="text-white/40 hover:text-white/80 active:text-white text-[10px] border border-white/10 rounded px-1.5 leading-tight"
              aria-label="exit easter egg"
            >
              ESC ✕
            </button>
          )}
        </div>
        <div className="text-elastic-yellow text-lg font-semibold">INDEXER</div>
        <div className="text-white/40 text-[10px] mb-3">an elastic classic</div>

        <Stat label="Documents Indexed" value={score} color="text-elastic-teal" />
        <Stat label="Personal Best"     value={best}  color="text-elastic-yellow" />
        <div className="mt-2 text-[10px] text-white/40 leading-relaxed">
          Arrow keys / WASD<br />
          Swipe to steer on the touchscreen<br />
          Don't bite your own shards
        </div>

        <div className="mt-auto text-[9px] text-white/30 leading-tight">
          // each document = 1 vector<br />
          // shards split when length % 8 == 0<br />
          // (just kidding · or am I)
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-2">
      <div className="text-[9px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

function Overlay({ title, subtitle, cta, onClick }: { title: string; subtitle: string; cta: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-center"
    >
      <div className="text-elastic-pink text-3xl font-bold tracking-widest">{title}</div>
      <div className="text-white/60 text-sm mt-1">{subtitle}</div>
      <div className="mt-4 px-4 py-2 border border-elastic-teal/50 bg-elastic-teal/10 text-elastic-teal text-xs uppercase tracking-widest rounded">
        {cta}
      </div>
    </button>
  )
}
