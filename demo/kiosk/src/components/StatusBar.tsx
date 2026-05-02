import { useEffect, useState } from 'react'

interface Props {
  mode: string
  onCycleMode: () => void
}

export function StatusBar({ mode, onCycleMode }: Props) {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(i)
  }, [])
  const hh = String(time.getHours()).padStart(2, '0')
  const mm = String(time.getMinutes()).padStart(2, '0')
  const ss = String(time.getSeconds()).padStart(2, '0')

  return (
    <div className="absolute top-0 left-0 right-0 h-7 px-3 flex items-center justify-between text-[11px] font-mono text-white/60 bg-black/40 backdrop-blur-sm border-b border-white/5 z-20">
      <div className="flex items-center gap-3">
        <span className="inline-block w-2 h-2 rounded-full bg-elastic-teal animate-pulse" />
        <span className="tracking-widest text-white/80">SOVEREIGN AI · DEMO KIT</span>
        <span className="text-white/30">|</span>
        <span className="uppercase text-elastic-yellow">{mode}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-white/40">192.168.1.10</span>
        <span className="text-white/30">|</span>
        <span className="text-white/40">AIRGAPPED</span>
        <span className="text-white/30">|</span>
        <span className="text-white/80">{hh}:{mm}:{ss}</span>
        <button
          onClick={onCycleMode}
          className="ml-2 px-2 py-0.5 rounded border border-white/15 text-white/70 hover:bg-white/10 active:bg-white/20"
        >
          MODE ▸
        </button>
      </div>
    </div>
  )
}
