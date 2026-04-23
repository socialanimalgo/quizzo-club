import { useEffect } from 'react'

type PageTransitionProps = {
  show: boolean
  onDone: () => void
}

export default function PageTransition({ show, onDone }: PageTransitionProps) {
  useEffect(() => {
    if (!show) return

    const timer = window.setTimeout(onDone, 700)
    return () => clearTimeout(timer)
  }, [onDone, show])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none">
      <div className="route-wipe-top absolute inset-x-0 top-0 h-1/2" style={{ background: 'var(--ink)' }} />
      <div className="route-wipe-bottom absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'var(--accent)' }} />
    </div>
  )
}
