import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export function useNotificationSummary() {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let mounted = true

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

    return () => {
      mounted = false
      clearInterval(id)
      window.removeEventListener('focus', tick)
    }
  }, [])

  return { unread, setUnread }
}
