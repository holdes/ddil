import { useEffect, useState } from 'react'
import { useFitScale } from './lib/useScale'
import { StatusBar } from './components/StatusBar'
import { DebugHud } from './components/DebugHud'
import { BootDiagnostics } from './modes/BootDiagnostics'
import { IdleBranding } from './modes/IdleBranding'
import { EasterEgg } from './modes/EasterEgg'
import { Pong } from './modes/Pong'

type Mode = 'boot' | 'idle' | 'game' | 'pong'

// Modes shown to the public via the MODE button. The two games are hidden —
// INDEXER opens via the secret tap on the Elastic logo (5 taps in 3s) / hotkey 3;
// PONG opens via the secret tap on the NVIDIA logo (5 taps in 3s) / hotkey 4.
const PUBLIC_MODES: Mode[] = ['boot', 'idle']
const MODE_LABELS: Record<Mode, string> = {
  boot: 'BOOT DIAGNOSTICS',
  idle: 'IDLE',
  game: '◆ INDEXER ◆',
  pong: '◆ PONG ◆',
}

export default function App() {
  const scale = useFitScale()
  const [mode, setMode] = useState<Mode>('boot')

  // Dev hotkeys: 1/2/3/4 jump directly to any mode (3 = snake, 4 = pong).
  // Arrow keys are owned by whichever mode is active (idle = page nav, game =
  // snake, pong = paddle).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '1') setMode('boot')
      else if (e.key === '2') setMode('idle')
      else if (e.key === '3') setMode('game')
      else if (e.key === '4') setMode('pong')
      else if (e.key === 'Escape' && (mode === 'game' || mode === 'pong')) setMode('idle')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  function cyclePublicMode() {
    const idx = PUBLIC_MODES.indexOf(mode as Mode)
    if (idx === -1) return setMode('idle')      // exit hidden modes via the MODE button
    setMode(PUBLIC_MODES[(idx + 1) % PUBLIC_MODES.length])
  }

  return (
    <div className="kiosk-frame">
      <div className="kiosk-stage" style={{ transform: `scale(${scale})` }}>
        <StatusBar mode={MODE_LABELS[mode]} onCycleMode={cyclePublicMode} />
        {/* Mode container starts below the 28px status bar. Use explicit
            top-7 instead of pt-7 because absolute-positioned children inside
            (e.g. inset-0) reference the padding box, not the content box —
            so padding wouldn't push them down. */}
        <div className="absolute top-7 left-0 right-0 bottom-0">
          {mode === 'boot' && <BootDiagnostics onComplete={() => setMode('idle')} />}
          {mode === 'idle' && (
            <IdleBranding
              onSecretUnlock={() => setMode('game')}
              onPongUnlock={() => setMode('pong')}
            />
          )}
          {mode === 'game' && <EasterEgg onExit={() => setMode('idle')} />}
          {mode === 'pong' && <Pong onExit={() => setMode('idle')} />}
        </div>
      </div>
      <DebugHud scale={scale} />
    </div>
  )
}
