import { useEffect, useState } from 'react'

const DESIGN_W = 1280
const DESIGN_H = 400

// Compute scale to fit the 1280x400 design inside the current viewport
// while preserving aspect ratio. Used by the kiosk frame.
export function useFitScale() {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    function recompute() {
      const sx = window.innerWidth / DESIGN_W
      const sy = window.innerHeight / DESIGN_H
      setScale(Math.min(sx, sy))
    }
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [])
  return scale
}
