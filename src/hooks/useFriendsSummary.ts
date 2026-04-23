import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export function useFriendsSummary() {
  const [friendCount, setFriendCount] = useState(0)
  const [incomingRequests, setIncomingRequests] = useState(0)

  useEffect(() => {
    let mounted = true
    api.users.friends()
      .then(({ friends, requests }) => {
        if (!mounted) return
        setFriendCount(friends.length)
        setIncomingRequests(requests.filter(r => r.direction === 'incoming').length)
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [])

  return { friendCount, incomingRequests }
}
