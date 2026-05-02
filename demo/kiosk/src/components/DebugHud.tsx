import { useEffect, useState } from 'react'

const DESIGN_W = 1280
const DESIGN_H = 400

interface Props {
  scale: number
}

// Tiny diagnostic overlay. Shows what Chrome actually thinks the viewport is,
// what scale we're applying, and the device pixel ratio. Toggle by appending
// ?debug=1 to the URL, or press the ` (backtick) key on the keyboard.
export function DebugHud({ scale }: Props) {
  const [enabled, setEnabled] = useState(() =>
    new URLSearchParams(location.search).has('debug'),
  )
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    function onResize() { setVp({ w: window.innerWidth, h: window.innerHeight }) }
    function onKey(e: KeyboardEvent) {
      if (e.key === '`') setEnabled(v => !v)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!enabled) return null

  const dpr = window.devicePixelRatio
  const fits = vp.w >= DESIGN_W && vp.h >= DESIGN_H
  const aspectVp = (vp.w / vp.h).toFixed(2)
  const aspectDesign = (DESIGN_W / DESIGN_H).toFixed(2)
  const renderedW = Math.round(DESIGN_W * scale)
  const renderedH = Math.round(DESIGN_H * scale)
  const wastedW = Math.max(0, vp.w - renderedW)
  const wastedH = Math.max(0, vp.h - renderedH)

  return (
    <div className="fixed top-1 left-1 z-50 font-mono text-[10px] leading-tight bg-black/85 border border-white/20 rounded px-2 py-1 text-white pointer-events-none">
      <div className="text-elastic-yellow font-semibold mb-0.5">DEBUG · ` to toggle</div>
      <Row k="viewport"     v={`${vp.w} × ${vp.h}  (${aspectVp}:1)`} />
      <Row k="design"       v={`${DESIGN_W} × ${DESIGN_H}  (${aspectDesign}:1)`} />
      <Row k="dpr"          v={String(dpr)} />
      <Row k="scale"        v={scale.toFixed(3)} />
      <Row k="rendered"     v={`${renderedW} × ${renderedH} px`} />
      <Row k="letterbox"    v={`${wastedW}px wide · ${wastedH}px tall`}
           color={wastedH > 50 || wastedW > 50 ? 'text-elastic-pink' : 'text-elastic-teal'} />
      <Row k="fits native?" v={fits ? 'yes' : 'no — viewport smaller than design'}
           color={fits ? 'text-elastic-teal' : 'text-elastic-pink'} />
    </div>
  )
}

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-white/40 w-20">{k}</span>
      <span className={color ?? 'text-white/90'}>{v}</span>
    </div>
  )
}
