import { useEffect, useState } from 'react'
import { useFitScale } from './lib/useScale'
import { StatusBar } from './components/StatusBar'
import { DebugHud } from './components/DebugHud'
import { BootDiagnostics } from './modes/BootDiagnostics'
import { IdleBranding } from './modes/IdleBranding'
import { Arcade } from './modes/Arcade'
import { EasterEgg } from './modes/EasterEgg'
import { Pong } from './modes/Pong'

type Mode = 'boot' | 'idle' | 'arcade' | 'game' | 'pong'

// Modes shown to the public via the MODE button. The games are hidden behind
// the ARCADE chooser, which opens via the secret tap on either brand logo
// (5 taps in 3s) / dev hotkey 3. Hotkey 4 jumps straight into RALLY.
const PUBLIC_MODES: Mode[] = ['boot', 'idle']
const MODE_LABELS: Record<Mode, string> = {
  boot: 'BOOT DIAGNOSTICS',
  idle: 'IDLE',
  arcade: '◆ ARCADE ◆',
  game: '◆ INDEXER ◆',
  pong: '◆ RALLY ◆',
}

export default function App() {
  const scale = useFitScale()
  const [mode, setMode] = useState<Mode>('boot')

  // Dev hotkeys: 1/2/3/4 jump directly (3 = arcade chooser, 4 = RALLY).
  // Arrow keys are owned by whichever mode is active (idle = page nav, arcade =
  // card select, game = snake, pong = paddles). ESC backs a game out to the
  // chooser, and the chooser out to idle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '1') setMode('boot')
      else if (e.key === '2') setMode('idle')
      else if (e.key === '3') setMode('arcade')
      else if (e.key === '4') setMode('pong')
      else if (e.key === 'Escape' && (mode === 'game' || mode === 'pong')) setMode('arcade')
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
          {mode === 'idle' && <IdleBranding onSecretUnlock={() => setMode('arcade')} />}
          {mode === 'arcade' && <Arcade onPick={setMode} onExit={() => setMode('idle')} />}
          {mode === 'game' && <EasterEgg onExit={() => setMode('arcade')} />}
          {mode === 'pong' && <Pong onExit={() => setMode('arcade')} />}
        </div>
      </div>
      <DebugHud scale={scale} />
    </div>
  )
}
