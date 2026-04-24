import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export function useNotificationSummary() {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let mounted = true
    const streamUrl = api.notifications.streamUrl()
    let stream: EventSource | null = null

    const tick = () => {
      api.notifications.summary()
        .then(r => {
          if (mounted) setUnread(r.unread_count || 0)
        })
        .catch(() => {})
    }

    tick()
    const id = window.setInterval(tick, 30_000)
    window.addEventListener('focus', tick)

    if (streamUrl) {
      stream = new EventSource(streamUrl)
      stream.addEventListener('summary', event => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          if (mounted) setUnread(data.unread_count || 0)
        } catch {}
      })
      stream.onerror = () => {}
    }

    return () => {
      mounted = false
      clearInterval(id)
      window.removeEventListener('focus', tick)
      stream?.close()
    }
  }, [])

  return { unread, setUnread }
}
