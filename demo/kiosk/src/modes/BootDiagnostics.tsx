import { useEffect, useRef, useState } from 'react'
import { ASCII_BANNER, SERVICES, checkService, type ServiceResult } from '../lib/health'
import { ElasticLogo } from '../components/ElasticLogo'

interface Props {
  onComplete?: () => void
}

type Phase = 'banner' | 'probing' | 'done'

interface LogLine {
  t: string
  text: string
  kind: 'info' | 'ok' | 'warn' | 'err' | 'banner'
}

function ts() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

export function BootDiagnostics({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('banner')
  const [lines, setLines] = useState<LogLine[]>([])
  const [results, setResults] = useState<Record<string, ServiceResult | 'pending' | 'running'>>(
    Object.fromEntries(SERVICES.map(s => [s.id, 'pending'])),
  )
  const [activeIdx, setActiveIdx] = useState(-1)
  const logRef = useRef<HTMLDivElement>(null)
  // StrictMode mounts effects twice in dev. Ref guard ensures the boot
  // sequence runs exactly once across remounts.
  const startedRef = useRef(false)

  const append = (text: string, kind: LogLine['kind'] = 'info') =>
    setLines(prev => [...prev, { t: ts(), text, kind }].slice(-200))

  // Banner intro then start probing.
  // The startedRef guard already ensures `run()` only fires once across
  // StrictMode's double-mount. We deliberately do NOT cancel the in-flight
  // sequence on unmount — React just ignores setState calls on unmounted
  // components, which is fine for a one-shot intro animation.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    async function run() {
      append('booting sovereign-ai kernel...', 'info')
      await sleep(220)
      ASCII_BANNER.split('\n').forEach(l => append(l, 'banner'))
      await sleep(400)
      append('mounting airgapped service mesh...', 'info')
      await sleep(180)
      append('loading runtime registry... ok', 'ok')
      await sleep(180)
      append('initializing service probes...', 'info')
      setPhase('probing')

      for (let i = 0; i < SERVICES.length; i++) {
        const svc = SERVICES[i]
        setActiveIdx(i)
        setResults(r => ({ ...r, [svc.id]: 'running' }))
        append(`probe ${svc.label.padEnd(22)} → ${svc.endpoint}`, 'info')
        const result = await checkService(svc)
        setResults(r => ({ ...r, [svc.id]: result }))
        const tag = result.ok ? '[ OK ]' : '[FAIL]'
        const kind = result.ok ? 'ok' : 'err'
        append(`${tag} ${svc.label} · ${result.latencyMs}ms · ${result.message}`, kind)
        await sleep(120)
      }
      setActiveIdx(-1)
      append('all subsystems checked.', 'info')
      await sleep(300)
      append('kit ready · awaiting demo handoff... ', 'ok')
      setPhase('done')
      await sleep(2200)
      onComplete?.()
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll the log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [lines])

  const okCount = Object.values(results).filter(r => typeof r === 'object' && r.ok).length
  const failCount = Object.values(results).filter(r => typeof r === 'object' && !r.ok).length
  const progress = Object.values(results).filter(r => typeof r === 'object').length / SERVICES.length

  return (
    <div className="absolute inset-0 grid grid-cols-[440px_1fr] gap-0 font-mono">
      {/* LEFT: branded service checklist */}
      <div className="border-r border-white/5 bg-bg-elev p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <ElasticLogo variant="horizontal" size={22} />
          <span className="text-[10px] text-white/40 uppercase tracking-widest">SYS CHECK</span>
        </div>
        <div className="flex-1 space-y-1">
          {SERVICES.map((svc, i) => {
            const r = results[svc.id]
            const state = r === 'pending' ? 'pending'
              : r === 'running' ? 'running'
              : (r as ServiceResult).ok ? 'ok' : 'fail'
            return (
              <div
                key={svc.id}
                className={`flex items-center gap-3 px-2 py-1.5 rounded transition-colors ${
                  i === activeIdx ? 'bg-white/5' : ''
                }`}
              >
                <StatusDot state={state} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white/90 truncate">{svc.label}</div>
                  <div className="text-[10px] text-white/40 truncate">{svc.detail}</div>
                </div>
                <div className="text-[10px] text-white/50 w-16 text-right tabular-nums">
                  {typeof r === 'object' ? `${r.latencyMs}ms` : state}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-white/50 mb-1">
            <span>{okCount} OK · {failCount} FAIL · {SERVICES.length - okCount - failCount} pending</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                failCount > 0 ? 'bg-elastic-pink' : 'bg-elastic-teal'
              }`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* RIGHT: rolling log */}
      <div className="relative">
        <div
          ref={logRef}
          className="absolute inset-0 p-3 overflow-hidden text-[11px] leading-[1.45]"
        >
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2 whitespace-pre">
              <span className="text-white/25 tabular-nums">{l.t}</span>
              <span className={kindColor(l.kind)}>{l.text}</span>
            </div>
          ))}
          {phase !== 'done' && <span className="cursor-blink text-elastic-teal" />}
        </div>
        {phase === 'done' && (
          <div className="absolute inset-x-0 bottom-3 text-center text-[12px] text-elastic-teal">
            ✓ ready · launching idle screen
          </div>
        )}
      </div>
    </div>
  )
}

function StatusDot({ state }: { state: 'pending' | 'running' | 'ok' | 'fail' }) {
  if (state === 'ok')      return <span className="w-2 h-2 rounded-full bg-elastic-teal shadow-[0_0_8px_rgba(0,191,179,0.8)]" />
  if (state === 'fail')    return <span className="w-2 h-2 rounded-full bg-elastic-pink shadow-[0_0_8px_rgba(240,78,152,0.8)]" />
  if (state === 'running') return <span className="w-2 h-2 rounded-full bg-elastic-yellow animate-pulse" />
  return <span className="w-2 h-2 rounded-full bg-white/15" />
}

function kindColor(k: LogLine['kind']) {
  switch (k) {
    case 'ok':     return 'text-elastic-teal'
    case 'warn':   return 'text-elastic-yellow'
    case 'err':    return 'text-elastic-pink'
    case 'banner': return 'text-elastic-blue'
    default:       return 'text-white/70'
  }
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}
