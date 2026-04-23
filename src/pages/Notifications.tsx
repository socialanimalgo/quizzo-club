import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import Icon from '../components/Icon'

type Filter = 'all' | 'unread'

function toneForNotification(notification: any) {
  const type = notification.type
  if (type === 'challenge_received' || type === 'challenge_invite') return { bg: '#06b6d4', text: '#111014', icon: 'swords' }
  if (type === 'challenge_result') return { bg: notification.data?.result === 'loss' ? '#fecaca' : '#bbf7d0', text: '#111014', icon: notification.data?.result === 'loss' ? 'x' : 'trophy' }
  if (type === 'friend_request') return { bg: '#fff', text: '#111014', icon: 'mail' }
  if (type === 'friend_request_accepted') return { bg: '#bbf7d0', text: '#111014', icon: 'user' }
  if (type === 'friend_request_declined') return { bg: '#fff', text: '#111014', icon: 'x' }
  if (type === 'streak') return { bg: '#fde68a', text: '#111014', icon: 'flame' }
  if (type === 'leaderboard_rank' || type === 'rank_up') return { bg: '#fff', text: '#111014', icon: 'chart' }
  return { bg: '#fff', text: '#111014', icon: 'mail' }
}

export default function Notifications() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>((params.get('tab') as Filter) || 'all')
  const [items, setItems] = useState<any[]>([])
  const [counts, setCounts] = useState({ all_count: 0, unread_count: 0 })

  useEffect(() => {
    api.auth.getUser().then(user => {
      if (!user) {
        navigate('/signin')
        return
      }
      load(filter)
    })
  }, [filter, navigate])

  async function load(nextFilter: Filter) {
    const result = await api.notifications.list(nextFilter)
    setItems(result.notifications)
    setCounts(result.counts)
  }

  function setTab(next: Filter) {
    setFilter(next)
    setParams(prev => {
      const draft = new URLSearchParams(prev)
      draft.set('tab', next)
      return draft
    })
  }

  async function markAllRead() {
    await api.notifications.markAllRead()
    await load(filter)
  }

  async function markRead(id: string) {
    await api.notifications.markRead(id)
    await load(filter)
  }

  async function respondToFriendRequest(notification: any, action: 'accept' | 'decline') {
    const requestId = notification.data?.request_id
    if (!requestId) return
    await api.users.respondToFriendRequest(requestId, action)
    await markRead(notification.id)
  }

  async function acceptChallenge(notification: any) {
    const challengeId = notification.data?.challenge_id
    if (!challengeId) return
    const data = await api.challenges.acceptById(challengeId)
    await markRead(notification.id)
    navigate('/quiz/play', { state: { session: { session_id: data.session_id, questions: data.questions, challenge_id: data.challenge_id, category_id: data.category_id }, returnTo: '/notifications' } })
  }

  const unread = useMemo(() => items.filter(item => !item.read_at).length, [items])

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <header className="px-4 pt-4 pb-3 border-b-[2.5px] sticky top-0 z-10" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/profile')} className="btl btl-sm sh-2 w-9 h-9 grid place-items-center" style={{ background: '#fff' }}>
            <Icon name="back" className="w-4 h-4" stroke={2.2} />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-[22px] leading-none">Obavijesti</h1>
            <div className="font-mono text-[10px] opacity-60 mt-0.5">{counts.unread_count} nepročitano</div>
          </div>
          <button onClick={markAllRead} className="btl btl-sm sh-2 px-2.5 py-1.5 flex items-center gap-1" style={{ background: '#fff' }}>
            <Icon name="check" className="w-3.5 h-3.5" stroke={2.8} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest">Sve</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar max-w-xl mx-auto px-4 py-4 space-y-4 w-full app-scroll-with-nav">
        <div className="btl sh-3 p-1 flex gap-1" style={{ background: '#fff' }}>
          {[
            { key: 'all', label: 'Sve', count: counts.all_count },
            { key: 'unread', label: 'Nepročitane', count: counts.unread_count },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as Filter)}
              className={`flex-1 py-2 font-mono text-[10px] font-bold uppercase tracking-widest rounded-[10px] flex items-center justify-center gap-1 ${filter === item.key ? '' : 'opacity-50'}`}
              style={filter === item.key ? { background: 'var(--ink)', color: '#fff', border: '1.5px solid var(--line)' } : {}}
            >
              {item.label} <span className="tabular opacity-80">({item.count})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {items.map(notification => {
            const tone = toneForNotification(notification)
            return (
              <div key={notification.id} className="btl sh-3 p-3 relative" style={{ background: tone.bg, color: tone.text }}>
                {!notification.read_at && (
                  <div className="absolute top-[-7px] right-[-7px] w-5 h-5 rounded-full" style={{ background: '#ef4444', border: '2px solid var(--line)' }} />
                )}
                <div className="flex items-start gap-3">
                  <div className="btl btl-sm w-12 h-12 grid place-items-center shrink-0" style={{ background: '#fff', borderWidth: 2 }}>
                    <Icon name={tone.icon} className="w-5 h-5" stroke={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-display text-[14.5px] leading-tight">{notification.title}</div>
                      <div className="font-mono text-[10px] opacity-60 whitespace-nowrap">{new Date(notification.created_at).toLocaleString('hr-HR')}</div>
                    </div>
                    <div className="font-mono text-[10px] opacity-80 mt-1 leading-relaxed">{notification.body}</div>
                    {notification.type === 'friend_request' && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => respondToFriendRequest(notification, 'accept')} className="btn btn-primary btn-sm">Prihvati</button>
                        <button onClick={() => respondToFriendRequest(notification, 'decline')} className="btn btn-sm" style={{ background: '#fff' }}>Odbij</button>
                      </div>
                    )}
                    {(notification.type === 'challenge_received' || notification.type === 'challenge_invite') && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => acceptChallenge(notification)} className="btn btn-primary btn-sm">Prihvati</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {!items.length && (
            <div className="btl sh-3 p-8 text-center" style={{ background: '#fff' }}>
              <div className="font-display text-[16px]">Nema obavijesti</div>
              <div className="font-mono text-[10px] opacity-60 mt-1">Bit ćemo tu kad nešto stigne</div>
            </div>
          )}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="btn w-full">
            Označi sve kao pročitano
          </button>
        )}
      </div>
    </div>
  )
}
