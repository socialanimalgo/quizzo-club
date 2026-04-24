import type { ReactNode } from 'react'
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react'
import LoadingScreen from '../components/LoadingScreen'

type LoaderState = {
  message?: string
  progress?: number
  order: number
}

type LoadingOverlayContextValue = {
  show: (id: string, payload?: { message?: string; progress?: number }) => void
  hide: (id: string) => void
}

const LoadingOverlayContext = createContext<LoadingOverlayContextValue>({
  show: () => {},
  hide: () => {},
})

export function LoadingOverlayProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, LoaderState>>({})
  const orderRef = useRef(0)

  const value = useMemo(() => ({
    show: (id: string, payload?: { message?: string; progress?: number }) => {
      setEntries(current => ({
        ...current,
        [id]: {
          message: payload?.message,
          progress: payload?.progress,
          order: ++orderRef.current,
        },
      }))
    },
    hide: (id: string) => {
      setEntries(current => {
        if (!current[id]) return current
        const next = { ...current }
        delete next[id]
        return next
      })
    },
  }), [])

  const active = Object.values(entries).sort((a, b) => b.order - a.order)[0] || null

  return (
    <LoadingOverlayContext.Provider value={value}>
      {children}
      {active && <LoadingScreen full message={active.message} progress={active.progress} />}
    </LoadingOverlayContext.Provider>
  )
}

export function useLoadingOverlay(loading: boolean, options?: { message?: string; progress?: number }) {
  const { show, hide } = useContext(LoadingOverlayContext)
  const idRef = useRef(`loader-${Math.random().toString(36).slice(2)}`)

  useLayoutEffect(() => {
    if (loading) {
      show(idRef.current, options)
    } else {
      hide(idRef.current)
    }

    return () => {
      hide(idRef.current)
    }
  }, [loading, options?.message, options?.progress, show, hide])
}
