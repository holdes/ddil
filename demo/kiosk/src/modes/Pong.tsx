import { useEffect, useRef, useState } from 'react'

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
const PADDLE_SPEED = 7       // player paddle px/tick under keyboard
const CPU_SPEED = 4.4        // AI paddle cap — the "CPU grinds", so GPU can win
const SERVE_COOLDOWN = 42    // ticks the ball holds center after a point (~0.7s)

// Brand hexes (mirrors the --color-* tokens in styles.css)
const GPU_GREEN   = '#76b900'
const CPU_BLUE    = '#1ba9f5'
const BALL_YELLOW = '#fec514'

interface PongProps {
  onExit?: () => void
}

export function Pong({ onExit }: PongProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gpuScore, setGpuScore] = useState(0)
  const [cpuScore, setCpuScore] = useState(0)
  const [running, setRunning]   = useState(false)
  const [winner, setWinner]     = useState<null | 'gpu' | 'cpu'>(null)

  // Mutable game state in refs so the loop doesn't restart every render
  const playerY = useRef((H - PADDLE_H) / 2)   // left paddle top (GPU, you)
  const cpuY    = useRef((H - PADDLE_H) / 2)    // right paddle top (CPU, AI)
  const ball    = useRef({ x: W / 2, y: H / 2, vx: BASE_SPEED, vy: 2 })
  const cooldown = useRef(0)
  const keyUp   = useRef(false)
  const keyDown = useRef(false)
  const scoreRef = useRef({ gpu: 0, cpu: 0 })  // mirror for the loop (avoids stale closures)
  const tickRef = useRef<number | null>(null)

  function serve(toward: 'gpu' | 'cpu') {
    // Ball starts center, moving toward whoever just conceded the point.
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
    playerY.current = (H - PADDLE_H) / 2
    cpuY.current    = (H - PADDLE_H) / 2
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
    // Loser serves next (ball goes toward the winner of the rally).
    serve(scorer)
  }

  function tick() {
    // --- Player paddle (keyboard) ---
    if (keyUp.current)   playerY.current -= PADDLE_SPEED
    if (keyDown.current) playerY.current += PADDLE_SPEED
    playerY.current = clamp(playerY.current, 0, H - PADDLE_H)

    // --- CPU paddle: track the ball only when it's incoming, else drift center ---
    const target = ball.current.vx > 0
      ? ball.current.y - PADDLE_H / 2
      : (H - PADDLE_H) / 2
    const dy = target - cpuY.current
    cpuY.current += clamp(dy, -CPU_SPEED, CPU_SPEED)
    cpuY.current = clamp(cpuY.current, 0, H - PADDLE_H)

    // --- Ball ---
    if (cooldown.current > 0) {
      cooldown.current -= 1
    } else {
      const b = ball.current
      b.x += b.vx
      b.y += b.vy

      // Top / bottom walls
      if (b.y - BALL_R < 0)     { b.y = BALL_R;     b.vy = Math.abs(b.vy) }
      if (b.y + BALL_R > H)     { b.y = H - BALL_R; b.vy = -Math.abs(b.vy) }

      // Left paddle (GPU)
      if (
        b.vx < 0 &&
        b.x - BALL_R <= PADDLE_X + PADDLE_W &&
        b.x - BALL_R >= PADDLE_X - 6 &&
        b.y >= playerY.current && b.y <= playerY.current + PADDLE_H
      ) {
        bounce(b, playerY.current, +1)
      }

      // Right paddle (CPU)
      const rx = W - PADDLE_X - PADDLE_W
      if (
        b.vx > 0 &&
        b.x + BALL_R >= rx &&
        b.x + BALL_R <= rx + PADDLE_W + 6 &&
        b.y >= cpuY.current && b.y <= cpuY.current + PADDLE_H
      ) {
        bounce(b, cpuY.current, -1)
      }

      // Out of bounds → point
      if (b.x < -BALL_R)      return finishTick(() => point('cpu'))
      if (b.x > W + BALL_R)   return finishTick(() => point('gpu'))
    }

    draw()
    tickRef.current = window.setTimeout(tick, 16)
  }

  // Deflect off a paddle: reverse x, steer y by contact point, nudge speed up.
  function bounce(b: { x: number; y: number; vx: number; vy: number }, paddleTop: number, dir: 1 | -1) {
    const rel = (b.y - (paddleTop + PADDLE_H / 2)) / (PADDLE_H / 2) // -1..1
    const speed = Math.min(MAX_SPEED, Math.hypot(b.vx, b.vy) + 0.5)
    const bounceAngle = rel * 0.9 // up to ~50°
    b.vx = dir * speed * Math.cos(bounceAngle)
    b.vy = speed * Math.sin(bounceAngle)
    // keep the ball clear of the paddle face so it can't re-trigger
    b.x = dir === 1 ? PADDLE_X + PADDLE_W + BALL_R : W - PADDLE_X - PADDLE_W - BALL_R
  }

  // Draw the final frame of a rally, score the point, then continue the loop.
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

    // Center net (dashed)
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    for (let y = 6; y < H; y += 24) ctx.fillRect(W / 2 - 1, y, 2, 14)

    // Faint center circle — a nod to the "vector" motif
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 44, 0, Math.PI * 2); ctx.stroke()

    // Paddles
    ctx.fillStyle = GPU_GREEN
    ctx.fillRect(PADDLE_X, playerY.current, PADDLE_W, PADDLE_H)
    ctx.fillStyle = CPU_BLUE
    ctx.fillRect(W - PADDLE_X - PADDLE_W, cpuY.current, PADDLE_W, PADDLE_H)

    // Ball (with a soft glow)
    const b = ball.current
    ctx.shadowColor = BALL_YELLOW
    ctx.shadowBlur = 12
    ctx.fillStyle = BALL_YELLOW
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0

    // Big center score
    ctx.font = 'bold 42px monospace'
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(118,185,0,0.25)'
    ctx.textAlign = 'right'
    ctx.fillText(String(scoreRef.current.gpu), W / 2 - 28, 14)
    ctx.fillStyle = 'rgba(27,169,245,0.25)'
    ctx.textAlign = 'left'
    ctx.fillText(String(scoreRef.current.cpu), W / 2 + 28, 14)
    ctx.textAlign = 'left'
  }

  function start() {
    if (running) return
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
      if (e.key === 'ArrowUp' || e.key === 'w')   { keyUp.current = true;   e.preventDefault() }
      else if (e.key === 'ArrowDown' || e.key === 's') { keyDown.current = true; e.preventDefault() }
      else if (e.key === ' ' || e.key === 'Enter') { start() }
    }
    function onUp(e: KeyboardEvent) {
      if (e.key === 'ArrowUp' || e.key === 'w')   keyUp.current = false
      else if (e.key === 'ArrowDown' || e.key === 's') keyDown.current = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  // Pointer / touch: the GPU paddle follows your finger (or mouse) vertically.
  // getBoundingClientRect accounts for the kiosk's useFitScale transform.
  function onPointerMove(e: React.PointerEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const y = ((e.clientY - rect.top) / rect.height) * H
    playerY.current = clamp(y - PADDLE_H / 2, 0, H - PADDLE_H)
    if (!running) draw()   // let the paddle track even on the serve overlay
  }

  return (
    <div className="absolute inset-0 grid grid-cols-[1fr_180px] gap-0">
      {/* Playfield */}
      <div
        className="relative flex items-center justify-center touch-none"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerMove}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block rounded border border-white/10"
        />
        {!running && !winner && (
          <Overlay
            title="PONG"
            subtitle="GPU vs CPU · first to 7"
            cta="TAP / SPACE TO SERVE"
            onClick={start}
          />
        )}
        {winner && (
          <Overlay
            title={winner === 'gpu' ? 'GPU WINS' : 'CPU WINS'}
            titleColor={winner === 'gpu' ? 'text-nvidia-green' : 'text-elastic-blue'}
            subtitle={`final · GPU ${gpuScore} — ${cpuScore} CPU`}
            cta="TAP / SPACE FOR REMATCH"
            onClick={start}
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
        <div className="text-nvidia-green text-lg font-semibold">PONG</div>
        <div className="text-white/40 text-[10px] mb-3">an nvidia classic</div>

        <Stat label="GPU · You" value={gpuScore} color="text-nvidia-green" />
        <Stat label="CPU · Opponent" value={cpuScore} color="text-elastic-blue" />
        <div className="mt-2 text-[10px] text-white/40 leading-relaxed">
          Up / Down or W / S<br />
          Touch &amp; drag to steer the paddle<br />
          First to {WIN_SCORE} takes the rack
        </div>

        <div className="mt-auto text-[9px] text-white/30 leading-tight">
          // GPU paddle = Blackwell<br />
          // CPU grinds · you shouldn't lose<br />
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

function Overlay({
  title, subtitle, cta, onClick, titleColor = 'text-elastic-pink',
}: {
  title: string; subtitle: string; cta: string; onClick: () => void; titleColor?: string
}) {
  return (
    <button
      onClick={onClick}
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-center"
    >
      <div className={`${titleColor} text-3xl font-bold tracking-widest`}>{title}</div>
      <div className="text-white/60 text-sm mt-1">{subtitle}</div>
      <div className="mt-4 px-4 py-2 border border-elastic-teal/50 bg-elastic-teal/10 text-elastic-teal text-xs uppercase tracking-widest rounded">
        {cta}
      </div>
    </button>
  )
}
