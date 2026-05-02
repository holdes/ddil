import { useEffect, useRef, useState } from 'react'
import { BrandingPage } from './idle/BrandingPage'
import { DiagnosticsPage } from './idle/DiagnosticsPage'

interface Props {
  onSecretUnlock: () => void
}

const PAGE_COUNT = 2

export function IdleBranding({ onSecretUnlock }: Props) {
  const [page, setPage] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  // ←/→ to nav between pages while in idle. (App-level arrow handler is gone.)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setPage(p => (p + 1) % PAGE_COUNT)
      else if (e.key === 'ArrowLeft') setPage(p => (p - 1 + PAGE_COUNT) % PAGE_COUNT)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) setPage(p => (p + 1) % PAGE_COUNT)
    else        setPage(p => (p - 1 + PAGE_COUNT) % PAGE_COUNT)
  }

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Sliding rail */}
      <div
        className="absolute top-0 left-0 h-full flex transition-transform duration-300 ease-out"
        style={{
          width: `${PAGE_COUNT * 100}%`,
          transform: `translateX(-${page * (100 / PAGE_COUNT)}%)`,
        }}
      >
        <div className="relative" style={{ width: `${100 / PAGE_COUNT}%` }}>
          <BrandingPage onSecretUnlock={onSecretUnlock} />
        </div>
        <div className="relative" style={{ width: `${100 / PAGE_COUNT}%` }}>
          <DiagnosticsPage />
        </div>
      </div>

      {/* Page indicator. Tucked into the bottom-right corner so it never
          overlays page content (the marquee on Branding, the Kv strip on
          Diagnostics). Chevrons are tiny so the cluster stays under ~80px. */}
      <div className="absolute bottom-1.5 right-2 flex items-center gap-1.5 z-10">
        <button
          aria-label="previous page"
          onClick={() => setPage(p => (p - 1 + PAGE_COUNT) % PAGE_COUNT)}
          className="text-white/30 hover:text-white/80 active:text-white text-[11px] leading-none px-0.5"
        >
          ◂
        </button>
        {Array.from({ length: PAGE_COUNT }).map((_, i) => (
          <button
            key={i}
            aria-label={`go to page ${i + 1}`}
            onClick={() => setPage(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === page ? 'bg-elastic-teal w-3.5' : 'bg-white/20 hover:bg-white/40 w-1.5'
            }`}
          />
        ))}
        <button
          aria-label="next page"
          onClick={() => setPage(p => (p + 1) % PAGE_COUNT)}
          className="text-white/30 hover:text-white/80 active:text-white text-[11px] leading-none px-0.5"
        >
          ▸
        </button>
      </div>
    </div>
  )
}
