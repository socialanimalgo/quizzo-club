import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import Icon from '../components/Icon'
import AppHeader from '../components/AppHeader'
import Avatar from '../components/Avatar'
import { useNotificationSummary } from '../hooks/useNotificationSummary'
import { useFriendsSummary } from '../hooks/useFriendsSummary'
import { useWallet } from '../context/WalletContext'
import { useLoadingOverlay } from '../context/LoadingOverlayContext'

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [countryCode, setCountryCode] = useState('HR')
  const { unread } = useNotificationSummary()
  const { friendCount, incomingRequests } = useFriendsSummary()
  const { wallet } = useWallet()

  useEffect(() => {
    api.auth.getUser().then(u => {
      if (!u) { navigate('/signin'); return }
      setUser(u)
    })
    fetch('/api/locale').then(r => r.json()).then(d => setCountryCode(d.countryCode || 'HR')).catch(() => {})
  }, [navigate])

  useLoadingOverlay(!user, { message: 'UČITAVAM PROFIL' })

  if (!user) return null

  const xp = user.xp ?? 0
  const rank = user.rank ?? 1
  const quizzes = user.total_quizzes ?? 0
  const currentStreak = user.current_streak ?? 0
  const langLabel = countryCode === 'HR' ? 'Hrvatski' : 'English'
  const langFlag = countryCode === 'HR' ? 'HR' : 'EN'

  function handleSignOut() {
    api.auth.logout()
    window.location.href = '/'
  }

  const rows = [
    {
      id: 'notifications',
      label: 'Obavijesti',
      value: unread > 0 ? `${unread} novih` : 'Sve pročitano',
      icon: 'mail',
      tone: '#fff',
      href: '/notifications',
    },
    {
      id: 'friends',
      label: 'Prijatelji',
      value: `${friendCount} · ${incomingRequests} novih`,
      icon: 'user',
      tone: '#fff',
      href: '/friends',
    },
    {
      id: 'history',
      label: 'Povijest mečeva',
      value: 'W/L',
      icon: 'swords',
      tone: '#fff',
      href: '/history',
    },
    {
      id: 'language',
      label: 'Jezik',
      value: `${langFlag} ${langLabel}`,
      icon: 'globe-alt',
      tone: '#fff',
      href: undefined,
    },
    // {
    //   id: 'subscription',
    //   label: 'Pretplata',
    //   value: 'Besplatno',
    //   icon: 'crown',
    //   tone: '#fde68a',
    //   href: '/subscribe',
    // },
    {
      id: 'shop',
      label: 'Shop',
      value: `${wallet.coins} coins · ${wallet.gems} gems`,
      icon: 'bag',
      tone: '#fff',
      href: '/shop',
    },
  ]

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <AppHeader />

      <div className="flex-1 overflow-y-auto no-scrollbar max-w-xl mx-auto w-full px-4 py-4 space-y-3 app-scroll-with-nav">
        {/* Avatar card */}
        <button onClick={() => navigate('/avatars')} className="btl btl-lg sh-ink-acc p-5 text-center w-full" style={{ background: '#fff' }}>
          <Avatar user={user} size={80} className="btl btl-sm sh-2 mx-auto mb-3" background="var(--accent)" textClassName="text-[36px]" />
          <div className="font-display text-[24px] leading-tight">{user.first_name} {user.last_name}</div>
          <div className="font-mono text-[10px] opacity-60 uppercase tracking-widest mt-1">{user.email}</div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-widest mt-2 opacity-60">Avatar banka →</div>
          <div className="mt-3 btl-sm btl" style={{ background: 'var(--paper)', padding: 2, height: 12, borderRadius: 999 }}>
            <div style={{
              height: '100%', width: `${Math.min(100, (xp % 500) / 5)}%`,
              borderRadius: 999, background: 'var(--accent)', border: '1.5px solid var(--line)',
              minWidth: xp > 0 ? 8 : 0,
            }} />
          </div>
          <div className="font-mono text-[10px] font-bold tabular mt-1 opacity-60">{xp} XP</div>
        </button>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'STREAK', value: currentStreak, suffix: <Icon name="flame" className="w-6 h-6" stroke={2.1} />, tone: '#fde68a' },
            { label: 'RANK', value: `#${rank}`, tone: '#fff' },
            { label: 'KVIZOVA', value: quizzes, tone: 'var(--accent)' },
          ].map(s => (
            <div key={s.label} className="btl sh-3" style={{ background: s.tone, padding: '12px 14px' }}>
              <div className="font-mono text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">{s.label}</div>
              <div className="font-display text-[20px] leading-none tabular flex items-center gap-1.5">
                <span>{s.value}</span>
                {'suffix' in s ? s.suffix : null}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="btl sh-3 p-2" style={{ background: '#fff' }}>
          <div className="font-mono text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60 px-1 pt-1">// POSTAVKE</div>
          {rows.map(row => {
            const content = (
              <>
                <div className="btl btl-sm w-9 h-9 grid place-items-center" style={{ background: row.tone, borderWidth: 2 }}>
                  <Icon name={row.icon} className="w-4 h-4" stroke={2.2} />
                </div>
                <div className="flex-1 font-display text-[14px]">{row.label}</div>
                <span className="font-mono text-[10px] opacity-60">{row.value}</span>
                <Icon name="chev" className="w-4 h-4 opacity-30" stroke={2.2} />
              </>
            )

            if (row.href) {
              return (
                <Link
                  key={row.id}
                  to={row.href}
                  className="w-full flex items-center gap-3 py-2.5 px-1 text-left border-b-[1.5px]"
                  style={{ borderColor: 'rgba(0,0,0,.08)' }}
                >
                  {content}
                </Link>
              )
            }

            return (
              <div
                key={row.id}
                className="w-full flex items-center gap-3 py-2.5 px-1 text-left border-b-[1.5px]"
                style={{ borderColor: 'rgba(0,0,0,.08)' }}
              >
                {content}
              </div>
            )
          })}
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 py-2.5 px-1 text-left">
            <div className="btl btl-sm w-9 h-9 grid place-items-center" style={{ background: '#fecaca', borderWidth: 2 }}>
              <Icon name="back" className="w-4 h-4" stroke={2.2} />
            </div>
            <div className="flex-1 font-display text-[14px]" style={{ color: '#dc2626' }}>Odjava</div>
            <Icon name="chev" className="w-4 h-4 opacity-30" stroke={2.2} />
          </button>
        </div>

        <div className="text-center font-mono text-[9px] opacity-40 uppercase tracking-widest">
          // QUIZZO CLUB v1.0 · 2026
        </div>
      </div>
    </div>
  )
}
