import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import Icon from '../components/Icon'
import AppHeader from '../components/AppHeader'
import Avatar from '../components/Avatar'

type Mode = 'challenge' | 'hunter'
type OpponentTab = 'friends' | 'search'

const MODES = {
  challenge: { icon: 'swords', label: 'Izazov', desc: 'Ista pitanja, pobjeđuje točniji.' },
  hunter: { icon: 'target', label: 'Hunter Mode', desc: 'Različita pitanja, ista kategorija.' },
}

const CATEGORIES = [
  { id: 'geography', icon: 'globe', name: 'Geografija', hue: 220 },
  { id: 'history', icon: 'scroll', name: 'Povijest', hue: 35 },
  { id: 'sports', icon: 'trophy', name: 'Sport', hue: 150 },
  { id: 'science', icon: 'atom', name: 'Priroda i Znan.', hue: 280 },
  { id: 'film_music', icon: 'music', name: 'Film i Glazba', hue: 345 },
  { id: 'pop_culture', icon: 'mask', name: 'Pop Kultura', hue: 25 },
]

export default function Challenges() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const opponentId = searchParams.get('opponent')

  const [user, setUser] = useState<any>(null)
  const [selectedCat, setSelectedCat] = useState('geography')
  const [mode, setMode] = useState<Mode>('challenge')
  const [creating, setCreating] = useState(false)
  const [friends, setFriends] = useState<any[]>([])
  const [incoming, setIncoming] = useState<any[]>([])
  const [opponentTab, setOpponentTab] = useState<OpponentTab>('friends')
  const [opponent, setOpponent] = useState<any>(null)
  const [searchValue, setSearchValue] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    api.auth.getUser().then(nextUser => {
      setUser(nextUser)
      if (!nextUser) navigate('/signin')
    })
    reloadLists()
  }, [navigate])

  useEffect(() => {
    if (!opponentId) {
      setOpponent(null)
      return
    }
    api.users.get(opponentId).then(result => setOpponent(result.user)).catch(() => setOpponent(null))
  }, [opponentId])

  useEffect(() => {
    if (opponentTab !== 'search') return
    const query = searchValue.trim().replace(/^@/, '')
    if (!query) {
      setSearchResults([])
      return
    }
    const timer = window.setTimeout(async () => {
      try {
        setSearching(true)
        const result = await api.users.search(query)
        setSearchResults(result.users)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [opponentTab, searchValue])

  async function reloadLists() {
    try {
      const [friendsResult, incomingResult] = await Promise.all([
        api.users.friends(),
        api.challenges.incoming(),
      ])
      setFriends(friendsResult.friends)
      setIncoming(incomingResult.challenges)
    } catch {}
  }

  function pickOpponent(person: any) {
    setOpponent(person)
    setStatus('')
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('opponent', person.id)
      return next
    })
  }

  function clearOpponent() {
    setOpponent(null)
    setStatus('')
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('opponent')
      return next
    })
  }

  async function handleCreate() {
    if (!user) {
      navigate('/signin')
      return
    }
    if (!opponent?.id) {
      setStatus('Prvo odaberi protivnika.')
      return
    }
    setCreating(true)
    setStatus('')
    try {
      await api.challenges.create(selectedCat, mode, opponent.id)
      setStatus(`Pozivnica poslana ${opponent.username ? `@${opponent.username}` : 'protivniku'}. Kviz počinje kad prihvati.`)
    } catch (err: any) {
      setStatus(err.message || 'Greška pri slanju pozivnice.')
    } finally {
      setCreating(false)
    }
  }

  async function acceptIncoming(challengeId: string) {
    const data = await api.challenges.acceptById(challengeId)
    navigate('/quiz/play', {
      state: {
        session: { session_id: data.session_id, questions: data.questions, challenge_id: data.challenge_id, category_id: data.category_id },
        categoryLabel: CATEGORIES.find(cat => cat.id === data.category_id)?.name?.toUpperCase(),
        returnTo: '/challenges',
      },
    })
  }

  const visibleResults = useMemo(() => searchResults.filter(person => person.id !== user?.id), [searchResults, user?.id])

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <AppHeader />

      <div className="flex-1 overflow-y-auto no-scrollbar max-w-xl mx-auto px-4 py-4 space-y-3 w-full app-scroll-with-nav">
        {incoming.length > 0 && (
          <div className="btl sh-4 p-4" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-display text-[16px] leading-none">Primljeni izazovi</div>
                <div className="font-mono text-[10px] opacity-60 mt-1">Prihvati i odmah kreni igrati</div>
              </div>
              <div className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>{incoming.length}</div>
            </div>
            <div className="flex flex-col gap-2.5">
              {incoming.map(challenge => (
                <div key={challenge.id} className="btl btl-sm p-3 flex items-center gap-3" style={{ background: 'var(--paper-deep)', borderWidth: 2 }}>
                  <Avatar user={{ avatar_url: challenge.challenger_avatar_url, selected_avatar_id: challenge.challenger_selected_avatar_id, username: challenge.challenger_username }} size={42} className="btl btl-sm" background="#fff" textClassName="text-[18px]" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[14px] truncate">@{challenge.challenger_username || 'igrac'}</div>
                    <div className="font-mono text-[10px] opacity-60 truncate">{challenge.category_name} · {challenge.mode === 'hunter' ? 'Hunter Mode' : 'Izazov'}</div>
                  </div>
                  <button onClick={() => acceptIncoming(challenge.id)} className="btn btn-primary btn-sm">Prihvati</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="btl sh-4 p-4" style={{ background: '#fff' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="chip" style={{ background: 'var(--accent)' }}><Icon name="user" className="w-3.5 h-3.5" stroke={2.2} /></span>
            <div>
              <div className="font-display text-[16px] leading-none">1. Odaberi protivnika</div>
              <div className="font-mono text-[10px] opacity-60 mt-1">Prijatelji ili pretraga po korisničkom imenu</div>
            </div>
          </div>

          {opponent ? (
            <div className="btl btl-sm p-3 flex items-center gap-3 mb-3" style={{ background: 'var(--accent-soft)', borderWidth: 2 }}>
              <Avatar user={opponent} size={44} className="btl btl-sm" background="#fff" textClassName="text-[18px]" />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">Odabrani protivnik</div>
                <div className="font-display text-[15px] truncate">@{opponent.username || 'igrac'}</div>
                <div className="font-mono text-[10px] opacity-60">{opponent.online ? 'Online' : 'Offline'}</div>
              </div>
              <button onClick={clearOpponent} className="btl btl-sm w-8 h-8 grid place-items-center" style={{ background: '#fff', borderWidth: 2 }}>
                <Icon name="x" className="w-4 h-4" stroke={2.2} />
              </button>
            </div>
          ) : (
            <div className="font-mono text-[10px] opacity-60 mb-3">Nijedan protivnik nije odabran.</div>
          )}

          <div className="btl sh-3 p-1 flex gap-1 mb-3" style={{ background: 'var(--paper-deep)' }}>
            {[
              { key: 'friends', label: 'Prijatelji' },
              { key: 'search', label: 'Traži @username' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setOpponentTab(item.key as OpponentTab)}
                className={`flex-1 py-2 font-mono text-[10px] font-bold uppercase tracking-widest rounded-[10px] ${opponentTab === item.key ? '' : 'opacity-50'}`}
                style={opponentTab === item.key ? { background: 'var(--ink)', color: '#fff', border: '1.5px solid var(--line)' } : {}}
              >
                {item.label}
              </button>
            ))}
          </div>

          {opponentTab === 'friends' ? (
            friends.length > 0 ? (
              <div className="flex flex-col gap-2">
                {friends.map(friend => (
                  <button key={friend.id} onClick={() => pickOpponent(friend)} className="btl btl-sm p-3 flex items-center gap-3 text-left" style={{ background: '#fff', borderWidth: 2 }}>
                    <Avatar user={friend} size={42} className="btl btl-sm" background="var(--paper-deep)" textClassName="text-[18px]" />
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-[14px] truncate">@{friend.username || 'igrac'}</div>
                      <div className="font-mono text-[10px] opacity-60">{friend.online ? 'Online' : 'Offline'}</div>
                    </div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">Odaberi</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="btl btl-sm p-4 text-center font-mono text-[10px] opacity-60" style={{ background: 'var(--paper-deep)', borderWidth: 2 }}>
                Nemaš još prijatelja. Otvori <Link to="/friends" className="underline">Prijatelje</Link> ili traži po korisničkom imenu.
              </div>
            )
          ) : (
            <div>
              <input className="inp mb-3" value={searchValue} onChange={event => setSearchValue(event.target.value.toLowerCase())} placeholder="@username" />
              {!searchValue.trim() && (
                <div className="font-mono text-[10px] opacity-60">Upiši korisničko ime za pretragu.</div>
              )}
              {searching && <div className="font-mono text-[10px] opacity-60">Tražim korisnike…</div>}
              <div className="flex flex-col gap-2">
                {visibleResults.map(person => (
                  <button key={person.id} onClick={() => pickOpponent(person)} className="btl btl-sm p-3 flex items-center gap-3 text-left" style={{ background: '#fff', borderWidth: 2 }}>
                    <Avatar user={person} size={42} className="btl btl-sm" background="var(--paper-deep)" textClassName="text-[18px]" />
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-[14px] truncate">@{person.username || 'igrac'}</div>
                      <div className="font-mono text-[10px] opacity-60 tabular">{person.rank ? `#${person.rank} · ` : ''}{Number(person.xp || 0).toLocaleString('hr-HR')} XP</div>
                    </div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">Odaberi</span>
                  </button>
                ))}
              </div>
              {searchValue.trim() && !searching && visibleResults.length === 0 && (
                <div className="btl btl-sm p-4 text-center font-mono text-[10px] opacity-60 mt-2" style={{ background: 'var(--paper-deep)', borderWidth: 2 }}>
                  Nema rezultata za @{searchValue.trim().replace(/^@/, '')}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="btl sh-4 p-4" style={{ background: '#fff' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="chip" style={{ background: 'var(--accent)' }}>2</span>
            <div className="font-display text-[16px] leading-none">Postavi izazov</div>
          </div>

          <div className="font-mono text-[10px] opacity-60 uppercase tracking-wider mb-2">Mod</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(Object.entries(MODES) as [Mode, typeof MODES['challenge']][]).map(([key, item]) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className="btl p-3 text-left"
                style={{
                  background: mode === key ? 'var(--accent)' : '#fff',
                  boxShadow: mode === key ? '4px 4px 0 0 var(--line)' : '2px 2px 0 0 var(--line)',
                }}
              >
                <div className="mb-1"><Icon name={item.icon} className="w-5 h-5" stroke={2.2} /></div>
                <div className="font-display text-[13px] leading-tight">{item.label}</div>
                <div className="font-mono text-[9px] opacity-70 mt-0.5 leading-tight">{item.desc}</div>
              </button>
            ))}
          </div>

          <div className="font-mono text-[10px] opacity-60 uppercase tracking-wider mb-2">Kategorija</div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className="btl p-2 text-center"
                style={{
                  background: selectedCat === cat.id ? `oklch(0.9 0.1 ${cat.hue})` : '#fff',
                  boxShadow: selectedCat === cat.id ? '3px 3px 0 0 var(--line)' : '2px 2px 0 0 var(--line)',
                }}
              >
                <div><Icon name={cat.icon} className="w-5 h-5 mx-auto" stroke={2.2} /></div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-wider truncate">{cat.name.split(' ')[0]}</div>
              </button>
            ))}
          </div>

          <button onClick={handleCreate} disabled={creating || !opponent} className="btn btn-primary w-full">
            {creating ? '…' : 'Pošalji VS pozivnicu'}
          </button>
          {!!status && <div className="font-mono text-[10px] mt-3 opacity-75">{status}</div>}
        </div>
      </div>
    </div>
  )
}
