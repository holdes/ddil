import { useRef, type ReactNode } from 'react'

interface Props {
  taps: number
  windowMs: number
  onUnlock: () => void
  children: ReactNode
  className?: string
}

// Wraps children in a tap target that fires `onUnlock` after N taps within
// a rolling time window. Used to hide the easter egg behind a discoverable
// but not-too-obvious gesture.
export function SecretTap({ taps, windowMs, onUnlock, children, className }: Props) {
  const stamps = useRef<number[]>([])
  function onTap() {
    const now = performance.now()
    stamps.current = [...stamps.current.filter(t => now - t < windowMs), now]
    if (stamps.current.length >= taps) {
      stamps.current = []
      onUnlock()
    }
  }
  return (
    <div className={className} onClick={onTap} role="button" tabIndex={-1}>
      {children}
    </div>
  )
}
