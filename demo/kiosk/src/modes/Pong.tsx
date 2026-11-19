import { useEffect, useRef, useState } from 'react'

// RALLY — the kiosk's second hidden game ("an nvidia + elastic classic").
// GPU paddle (nvidia-green) vs CPU paddle (elastic-blue), leaning into the
// kit's GPU-vs-CPU race story. Supports 1P (vs AI) and 2P (head-to-head).
//
// Playfield matches the snake's canvas footprint so the 1fr | 180px layout
// lines up: 1080×324 inside the left column, 180px side panel on the right.
const W = 1080
const H = 324

const PADDLE_W = 11
const PADDLE_H = 66
const PADDLE_X = 18          // left paddle x; right paddle mirrors at W - 18 - PADDLE_W
const BALL_R = 7
const WIN_SCORE = 7

const BASE_SPEED = 5.2       // ball px/tick at serve
const MAX_SPEED  = 11        // cap so it stays catchable on the touchscreen
const PADDLE_SPEED = 7       // human paddle px/tick under keyboard
const CPU_SPEED = 4.4        // AI paddle cap — the "CPU grinds", so GPU can win
const SERVE_COOLDOWN = 42    // ticks the ball holds center after a point (~0.7s)

// Brand hexes (mirrors the --color-* tokens in styles.css)
const GPU_GREEN   = '#76b900'
const CPU_BLUE    = '#1ba9f5'
const BALL_YELLOW = '#fec514'

type Players = 1 | 2

interface PongProps {
  onExit?: () => void
}

export function Pong({ onExit }: PongProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gpuScore, setGpuScore] = useState(0)
  const [cpuScore, setCpuScore] = useState(0)
  const [running, setRunning]   = useState(false)
  const [winner, setWinner]     = useState<null | 'gpu' | 'cpu'>(null)
  const [players, setPlayers]   = useState<Players>(1)

  // Mutable game state in refs so the loop doesn't restart every render
  const playersRef = useRef<Players>(1)
  const leftY   = useRef((H - PADDLE_H) / 2)   // left paddle top  (GPU — P1 / you)
  const rightY  = useRef((H - PADDLE_H) / 2)   // right paddle top (CPU — AI or P2)
  const ball    = useRef({ x: W / 2, y: H / 2, vx: BASE_SPEED, vy: 2 })
  const cooldown = useRef(0)
  // Keyboard state. P1 = W/S, P2 = Arrows. In 1P the left paddle accepts both.
  const kW = useRef(false), kS = useRef(false), kUp = useRef(false), kDown = useRef(false)
  const scoreRef = useRef({ gpu: 0, cpu: 0 })  // mirror for the loop (avoids stale closures)
  const tickRef = useRef<number | null>(null)

  function serve(toward: 'gpu' | 'cpu') {
    const angle = (Math.random() * 0.5 - 0.25) // shallow vertical spread
    ball.current = {
      x: W / 2,
      y: H / 2,
      vx: (toward === 'cpu' ? 1 : -1) * BASE_SPEED,
      vy: BASE_SPEED * angle,
    }
    cooldown.current = SERVE_COOLDOWN
  }

  function reset() {
    leftY.current  = (H - PADDLE_H) / 2
    rightY.current = (H - PADDLE_H) / 2
    scoreRef.current = { gpu: 0, cpu: 0 }
    setGpuScore(0)
    setCpuScore(0)
    setWinner(null)
    serve(Math.random() < 0.5 ? 'gpu' : 'cpu')
  }

  function point(scorer: 'gpu' | 'cpu') {
    const s = scoreRef.current
    if (scorer === 'gpu') { s.gpu += 1; setGpuScore(s.gpu) }
    else                  { s.cpu += 1; setCpuScore(s.cpu) }

    if (s.gpu >= WIN_SCORE || s.cpu >= WIN_SCORE) {
      setWinner(s.gpu >= WIN_SCORE ? 'gpu' : 'cpu')
      setRunning(false)
      if (tickRef.current) clearTimeout(tickRef.current)
      return
    }
    serve(scorer) // loser serves (ball heads toward the rally winner)
  }

  function tick() {
    const twoP = playersRef.current === 2

    // --- Left paddle (GPU / P1): W/S always; arrows too in 1P ---
    const lUp   = twoP ? kW.current : (kW.current || kUp.current)
    const lDown = twoP ? kS.current : (kS.current || kDown.current)
    if (lUp)   leftY.current -= PADDLE_SPEED
    if (lDown) leftY.current += PADDLE_SPEED
    leftY.current = clamp(leftY.current, 0, H - PADDLE_H)

    // --- Right paddle (CPU / P2) ---
    if (twoP) {
      if (kUp.current)   rightY.current -= PADDLE_SPEED
      if (kDown.current) rightY.current += PADDLE_SPEED
    } else {
      // AI: track the ball only when it's incoming, else drift to center
      const target = ball.current.vx > 0 ? ball.current.y - PADDLE_H / 2 : (H - PADDLE_H) / 2
      rightY.current += clamp(target - rightY.current, -CPU_SPEED, CPU_SPEED)
    }
    rightY.current = clamp(rightY.current, 0, H - PADDLE_H)

    // --- Ball ---
    if (cooldown.current > 0) {
      cooldown.current -= 1
    } else {
      const b = ball.current
      b.x += b.vx
      b.y += b.vy

      if (b.y - BALL_R < 0) { b.y = BALL_R;     b.vy = Math.abs(b.vy) }
      if (b.y + BALL_R > H) { b.y = H - BALL_R; b.vy = -Math.abs(b.vy) }

      // Left paddle
      if (b.vx < 0 && b.x - BALL_R <= PADDLE_X + PADDLE_W && b.x - BALL_R >= PADDLE_X - 6 &&
          b.y >= leftY.current && b.y <= leftY.current + PADDLE_H) {
        bounce(b, leftY.current, +1)
      }
      // Right paddle
      const rx = W - PADDLE_X - PADDLE_W
      if (b.vx > 0 && b.x + BALL_R >= rx && b.x + BALL_R <= rx + PADDLE_W + 6 &&
          b.y >= rightY.current && b.y <= rightY.current + PADDLE_H) {
        bounce(b, rightY.current, -1)
      }

      if (b.x < -BALL_R)    return finishTick(() => point('cpu'))
      if (b.x > W + BALL_R) return finishTick(() => point('gpu'))
    }

    draw()
    tickRef.current = window.setTimeout(tick, 16)
  }

  function bounce(b: { x: number; y: number; vx: number; vy: number }, paddleTop: number, dir: 1 | -1) {
    const rel = (b.y - (paddleTop + PADDLE_H / 2)) / (PADDLE_H / 2) // -1..1
    const speed = Math.min(MAX_SPEED, Math.hypot(b.vx, b.vy) + 0.5)
    const angle = rel * 0.9
    b.vx = dir * speed * Math.cos(angle)
    b.vy = speed * Math.sin(angle)
    b.x = dir === 1 ? PADDLE_X + PADDLE_W + BALL_R : W - PADDLE_X - PADDLE_W - BALL_R
  }

  function finishTick(scoreFn: () => void) {
    draw()
    scoreFn()
    if (scoreRef.current.gpu < WIN_SCORE && scoreRef.current.cpu < WIN_SCORE) {
      tickRef.current = window.setTimeout(tick, 16)
    }
  }

  function draw() {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0b0d12'
    ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    for (let y = 6; y < H; y += 24) ctx.fillRect(W / 2 - 1, y, 2, 14)

    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 44, 0, Math.PI * 2); ctx.stroke()

    ctx.fillStyle = GPU_GREEN
    ctx.fillRect(PADDLE_X, leftY.current, PADDLE_W, PADDLE_H)
    ctx.fillStyle = CPU_BLUE
    ctx.fillRect(W - PADDLE_X - PADDLE_W, rightY.current, PADDLE_W, PADDLE_H)

    const b = ball.current
    ctx.shadowColor = BALL_YELLOW
    ctx.shadowBlur = 12
    ctx.fillStyle = BALL_YELLOW
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0

    ctx.font = 'bold 42px monospace'
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(118,185,0,0.25)'
    ctx.textAlign = 'right'
    ctx.fillText(String(scoreRef.current.gpu), W / 2 - 28, 14)
    ctx.fillStyle = 'rgba(27,169,245,0.25)'
    ctx.textAlign = 'left'
    ctx.fillText(String(scoreRef.current.cpu), W / 2 + 28, 14)
  }

  function start(n: Players) {
    playersRef.current = n
    setPlayers(n)
    reset()
    setRunning(true)
    if (tickRef.current) clearTimeout(tickRef.current)
    tickRef.current = window.setTimeout(tick, 16)
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
    function onDown(e: KeyboardEvent) {
      if (e.key === 'w' || e.key === 'W')      { kW.current = true;   e.preventDefault() }
      else if (e.key === 's' || e.key === 'S') { kS.current = true;   e.preventDefault() }
      else if (e.key === 'ArrowUp')            { kUp.current = true;  e.preventDefault() }
      else if (e.key === 'ArrowDown')          { kDown.current = true; e.preventDefault() }
      else if ((e.key === ' ' || e.key === 'Enter') && !running) { start(1) }
    }
    function onUp(e: KeyboardEvent) {
      if (e.key === 'w' || e.key === 'W')      kW.current = false
      else if (e.key === 's' || e.key === 'S') kS.current = false
      else if (e.key === 'ArrowUp')            kUp.current = false
      else if (e.key === 'ArrowDown')          kDown.current = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  // Pointer / touch: each active pointer steers the paddle on its own half, so
  // two players can drag their own side (multi-touch). In 1P only the left
  // half steers. getBoundingClientRect accounts for the kiosk's scale.
  function onPointer(e: React.PointerEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const y = ((e.clientY - rect.top) / rect.height) * H
    const leftHalf = (e.clientX - rect.left) / rect.width < 0.5
    if (leftHalf)                          leftY.current  = clamp(y - PADDLE_H / 2, 0, H - PADDLE_H)
    else if (playersRef.current === 2)     rightY.current = clamp(y - PADDLE_H / 2, 0, H - PADDLE_H)
    if (!running) draw()
  }

  const twoP = players === 2

  return (
    <div className="absolute inset-0 grid grid-cols-[1fr_180px] gap-0">
      {/* Playfield */}
      <div
        className="relative flex items-center justify-center touch-none"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block rounded border border-white/10"
        />
        {!running && (
          <StartPanel
            result={winner ? { winner, gpuScore, cpuScore } : null}
            onStart={start}
          />
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
        <div className="flex items-baseline gap-2">
          <div className="text-nvidia-green text-lg font-semibold">RALLY</div>
          <div className="text-[9px] uppercase tracking-widest text-white/40 border border-white/10 rounded px-1">
            {twoP ? '2P' : '1P'}
          </div>
        </div>
        <div className="text-white/40 text-[10px] mb-3">an nvidia + elastic classic</div>

        <Stat label={twoP ? 'GPU · P1' : 'GPU · You'}      value={gpuScore} color="text-nvidia-green" />
        <Stat label={twoP ? 'CPU · P2' : 'CPU · Opponent'} value={cpuScore} color="text-elastic-blue" />
        <div className="mt-2 text-[10px] text-white/40 leading-relaxed">
          {twoP ? (
            <>P1: <span className="text-nvidia-green">W / S</span> · P2: <span className="text-elastic-blue">↑ / ↓</span><br />
            Or touch your own half<br />
            First to {WIN_SCORE} wins the rack</>
          ) : (
            <>↑ / ↓ or W / S<br />
            Touch &amp; drag to steer<br />
            First to {WIN_SCORE} beats the CPU</>
          )}
        </div>

        <div className="mt-auto text-[9px] text-white/30 leading-tight">
          // GPU paddle = Blackwell<br />
          {twoP ? '// head to head · no AI' : '// CPU grinds · you shouldn’t lose'}<br />
          // (8× faster · allegedly)
        </div>
      </div>
    </div>
  )
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-2">
      <div className="text-[9px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

// Centered start / game-over panel with the 1P and 2P choices. Buttons are
// centered on purpose so they sit in the kiosk touchscreen's reliable zone.
function StartPanel({
  result, onStart,
}: {
  result: { winner: 'gpu' | 'cpu'; gpuScore: number; cpuScore: number } | null
  onStart: (n: Players) => void
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-center gap-2.5">
      {result ? (
        <>
          <div className={`text-3xl font-bold tracking-widest ${result.winner === 'gpu' ? 'text-nvidia-green' : 'text-elastic-blue'}`}>
            {result.winner === 'gpu' ? 'GPU WINS' : 'CPU WINS'}
          </div>
          <div className="text-white/60 text-sm">final · GPU {result.gpuScore} — {result.cpuScore} CPU</div>
        </>
      ) : (
        <>
          <div className="text-nvidia-green text-3xl font-bold tracking-widest">RALLY</div>
          <div className="text-white/60 text-sm">GPU vs CPU · don’t drop the stream</div>
        </>
      )}
      <div className="flex gap-3 mt-2">
        <button
          onClick={() => onStart(1)}
          className="px-4 py-2 border border-nvidia-green/50 bg-nvidia-green/10 text-nvidia-green text-xs uppercase tracking-widest rounded hover:bg-nvidia-green/20"
        >
          1P · vs CPU
        </button>
        <button
          onClick={() => onStart(2)}
          className="px-4 py-2 border border-elastic-blue/50 bg-elastic-blue/10 text-elastic-blue text-xs uppercase tracking-widest rounded hover:bg-elastic-blue/20"
        >
          2P · head to head
        </button>
      </div>
      <div className="text-white/35 text-[9px] uppercase tracking-widest mt-1">
        {result ? 'pick a mode for a rematch' : 'space = quick 1P'}
      </div>
    </div>
  )
}
