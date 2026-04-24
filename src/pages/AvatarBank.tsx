import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import AppHeader from '../components/AppHeader'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import { useWallet } from '../context/WalletContext'
import { useLoadingOverlay } from '../context/LoadingOverlayContext'

type Tab = 'basic' | 'premium'

export default function AvatarBank() {
  const navigate = useNavigate()
  const { refreshWallet, user } = useWallet()
  const [tab, setTab] = useState<Tab>('basic')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [catalog, setCatalog] = useState<{ basic: any[]; premium: any[] }>({ basic: [], premium: [] })
  const [ownedIds, setOwnedIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gems, setGems] = useState(0)

  useEffect(() => {
    api.auth.getUser().then(currentUser => {
      if (!currentUser) {
        navigate('/signin')
        return
      }
      api.users.avatarBank().then(result => {
        setCatalog(result.catalog)
        setOwnedIds(result.owned_avatar_ids || [])
        setSelectedId(result.selected_avatar_id || null)
        setGems(result.gems || 0)
      }).catch(err => setError(err.message || 'Greška pri učitavanju avatara')).finally(() => setLoading(false))
    })
  }, [navigate])

  const avatars = useMemo(() => catalog[tab] || [], [catalog, tab])

  useLoadingOverlay(loading, { message: 'UČITAVAM AVATARE' })

  async function selectAvatar(avatar: any) {
    try {
      setBusyId(avatar.id)
      setError('')
      await api.users.selectAvatar(avatar.id)
      setSelectedId(avatar.id)
      await refreshWallet()
    } catch (err: any) {
      setError(err.message || 'Odabir avatara nije uspio')
    } finally {
      setBusyId('')
    }
  }

  async function buyAvatar(avatar: any) {
    try {
      setBusyId(avatar.id)
      setError('')
      const result = await api.users.buyAvatar(avatar.id)
      setOwnedIds(current => current.includes(avatar.id) ? current : [...current, avatar.id])
      setGems(result.gems || 0)
      await refreshWallet()
    } catch (err: any) {
      setError(err.message || 'Kupnja avatara nije uspjela')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <AppHeader />
      <div className="flex-1 overflow-y-auto no-scrollbar app-scroll-with-nav">
        <div className="max-w-xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/profile')} className="btn" style={{ minWidth: 128 }}>
              <Icon name="back" className="w-4 h-4" stroke={2.4} />
              Natrag
            </button>
            <div className="flex-1">
              <div className="font-display text-[24px] leading-none">Avatar banka</div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">
                Odaberi lika za profil i ljestvice
              </div>
            </div>
            <div className="btl btl-sm sh-2 px-3 py-2" style={{ background: '#ddd6fe' }}>
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Gems</div>
              <div className="font-display text-[20px] leading-none tabular">{gems}</div>
            </div>
          </div>

          <div className="btl sh-4 p-4 mb-4" style={{ background: '#fff' }}>
            <div className="flex items-center gap-3">
              <Avatar user={user} size={72} className="btl btl-sm sh-2 shrink-0" textClassName="text-[28px]" />
              <div className="min-w-0 flex-1">
                <div className="font-display text-[18px] leading-tight truncate">{user?.first_name} {user?.last_name}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest opacity-60 mt-1">Trenutni avatar</div>
                <div className="font-mono text-[11px] font-bold mt-2">{selectedId || 'Početni profilni avatar'}</div>
              </div>
            </div>
          </div>

          <div className="btl sh-3 p-1 flex gap-1 mb-4" style={{ background: '#fff' }}>
            {([
              { key: 'basic', label: 'Basic', count: catalog.basic.length },
              { key: 'premium', label: 'Premium', count: catalog.premium.length },
            ] as const).map(item => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`flex-1 py-2 font-mono text-[10px] font-bold uppercase tracking-widest rounded-[10px] ${tab === item.key ? '' : 'opacity-50'}`}
                style={tab === item.key ? { background: 'var(--ink)', color: '#fff', border: '1.5px solid var(--line)' } : {}}
              >
                {item.label} · {item.count}
              </button>
            ))}
          </div>

          {error && (
            <div className="btl p-3 mb-4 font-mono text-[11px] font-bold" style={{ background: '#fecaca', borderColor: '#dc2626' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="btl sh-3 aspect-square animate-pulse" style={{ background: '#fff' }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {avatars.map(avatar => {
                const owned = ownedIds.includes(avatar.id)
                const selected = selectedId === avatar.id
                const premium = avatar.pack === 'premium'
                const busy = busyId === avatar.id

                return (
                  <div key={avatar.id} className="btl sh-3 p-3 flex flex-col" style={{ background: '#fff' }}>
                    <div className="relative mb-3">
                      <div className="btl btl-sm overflow-hidden aspect-square" style={{ background: premium ? '#f3e8ff' : 'var(--paper-deep)' }}>
                        <img src={avatar.image_url} alt={avatar.label} className="w-full h-full object-cover" />
                      </div>
                      {premium && (
                        <span className="chip absolute top-2 left-2" style={{ background: '#111014', color: '#fff' }}>PREMIUM</span>
                      )}
                      {selected && (
                        <span className="absolute top-2 right-2 w-8 h-8 btl btl-sm grid place-items-center" style={{ background: 'var(--accent)' }}>
                          <Icon name="check" className="w-4 h-4" stroke={2.8} />
                        </span>
                      )}
                      {!owned && premium && (
                        <span className="absolute bottom-2 right-2 chip" style={{ background: '#fde68a' }}>{avatar.price_gems} gems</span>
                      )}
                    </div>
                    <div className="font-display text-[14px] leading-tight mb-1">{avatar.label}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest opacity-50 mb-3">{premium ? 'Kupnja otključava' : 'Besplatno'}</div>

                    {selected ? (
                      <button className="btn btn-sm w-full" disabled>
                        <Icon name="check" className="w-3.5 h-3.5" stroke={2.8} />
                        Odabrano
                      </button>
                    ) : owned ? (
                      <button onClick={() => selectAvatar(avatar)} disabled={busy} className="btn btn-sm w-full">
                        <Icon name="user" className="w-3.5 h-3.5" stroke={2.2} />
                        {busy ? 'Spremam…' : 'Odaberi'}
                      </button>
                    ) : (
                      <button onClick={() => buyAvatar(avatar)} disabled={busy} className="btn btn-sm w-full" style={{ background: '#fde68a' }}>
                        <Icon name="bag" className="w-3.5 h-3.5" stroke={2.2} />
                        {busy ? 'Kupujem…' : `Kupi · ${avatar.price_gems}`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
