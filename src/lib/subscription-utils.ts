import { useEffect, useState } from 'react'
import { api } from './api'

export function useSubscription(userId: string | undefined) {
  const [sub, setSub] = useState({ isActive: false, isTrialing: false, loading: true })

  useEffect(() => {
    if (!userId) {
      setSub({ isActive: false, isTrialing: false, loading: false })
      return
    }
    api.subscription.get()
      .then(data => setSub({
        isActive: data.status === 'active',
        isTrialing: data.status === 'trialing',
        loading: false,
      }))
      .catch(() => setSub({ isActive: false, isTrialing: false, loading: false }))
  }, [userId])

  return sub
}
