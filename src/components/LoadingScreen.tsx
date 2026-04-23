import { useEffect, useState } from 'react'
import QuizzoLogo from './QuizzoLogo'

type LoadingScreenProps = {
  full?: boolean
  message?: string
  progress?: number
}

const MESSAGES = [
  'MJEŠAM PITANJA',
  'BROJIM POENE',
  'TRAŽIM NAJBOLJE',
  'PRIPREMAM KVIZ',
  'UČITAVAM',
]

export default function LoadingScreen({ full = false, message, progress }: LoadingScreenProps) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [dots, setDots] = useState('')
  const [autoProgress, setAutoProgress] = useState(0)

  useEffect(() => {
    const messageTimer = window.setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 900)
    const dotsTimer = window.setInterval(() => setDots(d => (d.length >= 3 ? '' : `${d}.`)), 280)
    let frame = 0
    const start = performance.now()

    const tick = (time: number) => {
      const nextProgress = Math.min(100, ((time - start) / 1800) * 100)
      setAutoProgress(nextProgress)
      if (nextProgress < 100) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)

    return () => {
      clearInterval(messageTimer)
      clearInterval(dotsTimer)
      cancelAnimationFrame(frame)
    }
  }, [])

  const shownProgress = progress ?? autoProgress

  return (
    <div
      className={`${full ? 'fixed' : 'absolute'} inset-0 z-50 flex flex-col items-center justify-center`}
      style={{ background: 'var(--paper)' }}
    >
      <div className="absolute inset-0 grid-dots opacity-60 anim-gridShift" />
      <div className="relative flex flex-col items-center">
        <div className="mb-6 anim-pop">
          <QuizzoLogo size={88} spin />
        </div>
        <div className="font-display text-[28px] tracking-tight leading-none mb-1">
          Quizzo<span style={{ color: 'var(--accent-deep)' }}>.</span>
        </div>
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] opacity-60 mb-6">CLUB</div>

        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[11px] font-bold tabular uppercase tracking-widest">
            {(message || MESSAGES[msgIdx]) + dots}
          </span>
        </div>

        <div className="btl sh-3 w-64 overflow-hidden" style={{ height: 18, padding: 2, background: '#fff' }}>
          <div
            style={{
              height: '100%',
              width: `${shownProgress}%`,
              background: 'var(--accent)',
              borderRadius: 4,
              transition: 'width 0.2s linear',
              position: 'relative',
            }}
          >
            <div className="stripes absolute inset-0" style={{ opacity: 0.35 }} />
          </div>
        </div>
        <div className="font-mono text-[10px] font-bold tabular mt-2 opacity-60">{Math.round(shownProgress)}%</div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">// HRVATSKA · 2026</span>
      </div>
    </div>
  )
}
