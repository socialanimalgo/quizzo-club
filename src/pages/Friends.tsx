import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import Icon from '../components/Icon'
import Avatar from '../components/Avatar'

type Tab = 'friends' | 'requests' | 'find'

export default function Friends() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'friends')
  const [friends, setFriends] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const next = params.get('tab') as Tab | null
    if (next && next !== tab) setTab(next)
  }, [params, tab])

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    const id = window.setTimeout(() => {
      setSearching(true)
      api.users.search(query.trim())
        .then(r => setSearchResults(r.users))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 300)

    return () => clearTimeout(id)
  }, [query])

  async function load() {
    const user = await api.auth.getUser()
    if (!user) {
      navigate('/signin')
      return
    }
    const { friends, requests } = await api.users.friends()
    setFriends(friends)
    setRequests(requests)
  }

  function changeTab(next: Tab) {
    setTab(next)
    setParams(prev => {
      const draft = new URLSearchParams(prev)
      draft.set('tab', next)
      return draft
    })
  }

  async function respond(requestId: string, action: 'accept' | 'decline') {
    await api.users.respondToFriendRequest(requestId, action)
    await load()
  }

  async function addOrAccept(user: any) {
    await api.users.sendFriendRequest(user.id)
    await load()
    if (query.trim()) {
      const res = await api.users.search(query.trim())
      setSearchResults(res.users)
    }
  }

  const incoming = useMemo(() => requests.filter(r => r.direction === 'incoming'), [requests])
  const outgoing = useMemo(() => requests.filter(r => r.direction === 'outgoing'), [requests])

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <header className="px-4 pt-4 pb-3 border-b-[2.5px] sticky top-0 z-10" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/profile')} className="btl btl-sm sh-2 w-9 h-9 grid place-items-center" style={{ background: '#fff' }}>
            <Icon name="back" className="w-4 h-4" stroke={2.2} />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-[22px] leading-none">Prijatelji</h1>
            <div className="font-mono text-[10px] opacity-60 mt-0.5">
              {friends.length} prijatelja{incoming.length > 0 ? ` · ${incoming.length} novih zahtjeva` : ''}
            </div>
          </div>
          <Link to="/history" className="btl btl-sm sh-2 px-2.5 py-1.5 flex items-center gap-1" style={{ background: '#fff' }}>
            <Icon name="swords" className="w-3.5 h-3.5" stroke={2.2} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest">Povijest</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar max-w-xl mx-auto px-4 py-4 space-y-4 w-full app-scroll-with-nav">
        <div className="btl sh-3 p-1 flex gap-1" style={{ background: '#fff' }}>
          {[
            { key: 'friends', label: 'Prijatelji', count: friends.length, icon: 'user' },
            { key: 'requests', label: 'Zahtjevi', count: requests.length, icon: 'mail' },
            { key: 'find', label: 'Pronađi', count: null, icon: 'sparkle' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => changeTab(item.key as Tab)}
              className={`flex-1 py-2 font-mono text-[10px] font-bold uppercase tracking-widest rounded-[10px] flex items-center justify-center gap-1 ${tab === item.key ? '' : 'opacity-50'}`}
              style={tab === item.key ? { background: 'var(--ink)', color: '#fff', border: '1.5px solid var(--line)' } : {}}
            >
              <Icon name={item.icon} className="w-3 h-3" stroke={2.2} />
              {item.label}
              {item.count ? <span className="tabular opacity-80">({item.count})</span> : null}
            </button>
          ))}
        </div>

        {tab === 'friends' && (
          <>
            <div className="flex flex-col gap-2">
              {friends.map((friend, index) => (
                <div key={friend.id} className="btl sh-3 p-3 flex items-center gap-3 anim-slidein" style={{ background: '#fff', animationDelay: `${index * 0.04}s` }}>
                  <Avatar user={friend} size={48} className="btl btl-sm shrink-0" background="var(--paper-deep)" textClassName="text-[24px]" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[14.5px] leading-tight truncate">@{friend.username || 'igrac'}</div>
                    <div className="font-mono text-[10px] opacity-60 mt-0.5 truncate">{friend.online ? 'Online' : 'Offline'}</div>
                  </div>
                  <button
                    onClick={() => navigate(`/challenges?opponent=${friend.id}`)}
                    className="btl btl-sm px-2.5 py-1.5 flex items-center gap-1"
                    style={{ background: 'var(--accent)', boxShadow: '2px 2px 0 0 var(--line)', borderWidth: 2 }}
                  >
                    <Icon name="swords" className="w-3.5 h-3.5" stroke={2.2} />
                    <span className="font-mono text-[9.5px] font-bold uppercase tracking-widest">VS</span>
                  </button>
                </div>
              ))}
            </div>
            {!friends.length && (
              <div className="btl sh-3 p-8 text-center" style={{ background: '#fff' }}>
                <div className="font-display text-[16px]">Još nema prijatelja</div>
                <div className="font-mono text-[10px] opacity-60 mt-1">Pronađi nekoga za izazov</div>
                <button onClick={() => changeTab('find')} className="btn btn-primary mt-4">
                  Dodaj prijatelje
                </button>
              </div>
            )}
          </>
        )}

        {tab === 'requests' && (
          <>
            {incoming.length > 0 && (
              <>
                <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.25em] opacity-50 px-1">// DOLAZNI · {incoming.length}</div>
                <div className="flex flex-col gap-2">
                  {incoming.map(request => (
                    <div key={request.id} className="btl sh-3 p-3" style={{ background: '#fff' }}>
                      <div className="flex items-center gap-3">
                        <Avatar user={request.user} size={48} className="btl btl-sm" background="var(--paper-deep)" textClassName="text-[24px]" />
                        <div className="flex-1 min-w-0">
                          <div className="font-display text-[14.5px] leading-tight truncate">@{request.user.username || 'igrac'}</div>
                          <div className="font-mono text-[10px] opacity-60 mt-0.5">Zahtjev · {new Date(request.created_at).toLocaleDateString('hr-HR')}</div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => respond(request.id, 'accept')} className="btn btn-primary flex-1 btn-sm">Prihvati</button>
                        <button onClick={() => respond(request.id, 'decline')} className="btn btn-sm flex-1" style={{ background: '#fecaca' }}>Odbij</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {outgoing.length > 0 && (
              <>
                <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.25em] opacity-50 px-1 pt-2">// POSLANI · {outgoing.length}</div>
                <div className="flex flex-col gap-2">
                  {outgoing.map(request => (
                    <div key={request.id} className="btl sh-2 p-3 flex items-center gap-3" style={{ background: 'var(--paper-deep)' }}>
                      <Avatar user={request.user} size={40} className="btl btl-sm" background="#fff" textClassName="text-[20px]" />
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-[13.5px] truncate">@{request.user.username || 'igrac'}</div>
                        <div className="font-mono text-[9.5px] opacity-60">Čeka odgovor</div>
                      </div>
                      <span className="chip">ČEKA</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!incoming.length && !outgoing.length && (
              <div className="btl sh-3 p-8 text-center" style={{ background: '#fff' }}>
                <div className="font-display text-[16px]">Nema zahtjeva</div>
                <div className="font-mono text-[10px] opacity-60 mt-1">Pronađi nove igrače</div>
              </div>
            )}
          </>
        )}

        {tab === 'find' && (
          <>
            <div className="relative">
              <input value={query} onChange={e => setQuery(e.target.value.toLowerCase())} placeholder="@username" className="inp pl-10" />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">
                <Icon name="sparkle" className="w-4 h-4" stroke={2.2} />
              </div>
            </div>
            <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.25em] opacity-50 px-1">
              // {query.trim() ? 'REZULTATI' : 'UPIŠI POJAM ZA PRETRAGU'}
            </div>
            {query.trim() ? (
              <div className="flex flex-col gap-2">
                {searchResults.map((result, index) => (
                  <div key={result.id} className="btl sh-2 p-2.5 flex items-center gap-3 anim-slidein" style={{ background: '#fff', animationDelay: `${index * 0.03}s` }}>
                    <Avatar user={result} size={44} className="btl btl-sm" background="var(--paper-deep)" textClassName="text-[22px]" />
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-[13.5px] truncate">@{result.username || 'igrac'}</div>
                      <div className="font-mono text-[9.5px] opacity-60 mt-0.5 truncate">{result.rank ? `#${result.rank} · ` : ''}{Number(result.xp || 0).toLocaleString('hr-HR')} XP</div>
                    </div>
                    {result.is_friend ? (
                      <button disabled className="btl btl-sm px-2.5 py-1.5 opacity-60" style={{ background: 'var(--paper-deep)', borderWidth: 2 }}>
                        <span className="font-mono text-[9.5px] font-bold uppercase tracking-widest">Prijatelj</span>
                      </button>
                    ) : result.request_sent ? (
                      <button disabled className="btl btl-sm px-2.5 py-1.5 opacity-60" style={{ background: 'var(--paper-deep)', borderWidth: 2 }}>
                        <span className="font-mono text-[9.5px] font-bold uppercase tracking-widest">Poslano</span>
                      </button>
                    ) : (
                      <button onClick={() => addOrAccept(result)} className="btl btl-sm px-2.5 py-1.5" style={{ background: 'var(--ink)', color: '#fff', boxShadow: '2px 2px 0 0 var(--line)', borderWidth: 2 }}>
                        <span className="font-mono text-[9.5px] font-bold uppercase tracking-widest">{result.request_received ? 'Prihvati' : 'Dodaj'}</span>
                      </button>
                    )}
                  </div>
                ))}
                {!searchResults.length && !searching && (
                  <div className="btl sh-2 p-6 text-center" style={{ background: '#fff' }}>
                    <div className="font-mono text-[10.5px] opacity-60">Nema rezultata za @{query.replace(/^@/, '')}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="btl sh-2 p-6 text-center" style={{ background: '#fff' }}>
                <div className="font-mono text-[10.5px] opacity-60">Počni tipkati za pretragu igrača</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
