import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { api } from '../lib/api'
import { KVIZOPOLI_TOPICS } from '../data/categories'

type Match = {
  id: string
  joinCode: string
  hostUserId: string
  status: string
  phase: string
  players: Array<{
    id: string
    name: string
    avatar?: string | null
    color: string
    position: number
    connected: boolean
    correctAnswers: number
    takeoverCount: number
    averageAnswerMs: number
    seatIndex: number
  }>
  boardSpaces: Array<{
    id: number
    topicId: string
    ownerId: string | null
  }>
  activePlayerId: string | null
  startedAt: string | null
  durationMs: number
  endsAt: string | null
  currentDiceValue?: number | null
  currentQuestion?: {
    id: string
    spaceId: number
    topicId: string
    prompt: string
    answers: Array<{ id: string; text: string }>
    expiresAt?: string
  } | null
}

function propertyCount(boardSpaces: Match['boardSpaces'], playerId: string) {
  return boardSpaces.filter(space => space.ownerId === playerId).length
}

export default function Kvizopoli() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const joinCode = params.get('code') || ''
  const [viewer, setViewer] = useState<any>(undefined)
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(0)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteMode, setInviteMode] = useState<'friends' | 'search' | 'join'>('friends')
  const [inviteQuery, setInviteQuery] = useState('')
  const [friends, setFriends] = useState<any[]>([])
  const [searchUsers, setSearchUsers] = useState<any[]>([])
  const [inviteState, setInviteState] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    api.auth.getUser().then(currentUser => {
      setViewer(currentUser)
      if (!currentUser) navigate('/signin')
    }).catch(() => navigate('/signin'))
  }, [navigate])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (viewer === undefined) return
    if (!viewer) return
    let cancelled = false
    const boot = async () => {
      try {
        setLoading(true)
        setError('')
        const result = joinCode ? await api.kvizopoli.join(joinCode) : await api.kvizopoli.create()
        if (!cancelled) {
          setMatch(result.match)
          if (!joinCode) {
            setParams(prev => {
              const next = new URLSearchParams(prev)
              next.set('match', result.match.id)
              return next
            })
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Kvizopoli nije dostupan')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [joinCode, navigate, setParams, viewer])

  useEffect(() => {
    if (!match?.id) return
    let cancelled = false
    const tick = async () => {
      try {
        const result = await api.kvizopoli.state(match.id)
        if (!cancelled) setMatch(result.match)
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Kvizopoli nije dostupan')
      }
    }

    const streamUrl = api.kvizopoli.streamUrl(match.id)
    const stream = streamUrl ? new EventSource(streamUrl) : null
    stream?.addEventListener('state', event => {
      try {
        const next = JSON.parse((event as MessageEvent).data)
        if (!cancelled) setMatch(next)
      } catch {}
    })
    stream?.addEventListener('error', () => {
      void tick()
    })

    const onFocus = () => {
      void tick()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      stream?.close()
    }
  }, [match?.id])

  useEffect(() => {
    if (!viewer) return
    api.users.friends().then(result => {
      setFriends(result.friends)
    }).catch(() => {})
  }, [viewer])

  useEffect(() => {
    if (inviteMode !== 'search' || !inviteQuery.trim()) {
      setSearchUsers([])
      return
    }
    const timeout = window.setTimeout(() => {
      api.users.search(inviteQuery.trim()).then(result => {
        setSearchUsers(result.users)
      }).catch(() => setSearchUsers([]))
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [inviteMode, inviteQuery])

  const seatPlayers = useMemo(() => {
    const seats = [null, null, null, null] as Array<Match['players'][number] | null>
    match?.players.forEach(player => {
      seats[player.seatIndex] = player
    })
    return seats
  }, [match])

  const me = useMemo(() => match?.players.find(player => player.id === viewer?.id) || null, [match, viewer?.id])
  const isLobby = !!match && (match.status === 'lobby' || match.phase === 'waiting_for_players')
  const isHost = match?.hostUserId === viewer?.id
  const timeLeftMs = Math.max(0, match?.endsAt ? new Date(match.endsAt).getTime() - now : match?.durationMs || 0)
  const timerPct = match?.endsAt ? Math.max(0, Math.min(100, (timeLeftMs / match.durationMs) * 100)) : 100
  const timerText = match?.endsAt
    ? `${String(Math.floor(timeLeftMs / 60000)).padStart(2, '0')}:${String(Math.floor((timeLeftMs % 60000) / 1000)).padStart(2, '0')}`
    : 'LOBBY'

  const winner = useMemo(() => {
    if (!match?.players?.length) return null
    return [...match.players].sort((left, right) => {
      const propertyDelta = propertyCount(match.boardSpaces, right.id) - propertyCount(match.boardSpaces, left.id)
      if (propertyDelta !== 0) return propertyDelta
      const correctDelta = right.correctAnswers - left.correctAnswers
      if (correctDelta !== 0) return correctDelta
      const takeoverDelta = right.takeoverCount - left.takeoverCount
      if (takeoverDelta !== 0) return takeoverDelta
      return left.averageAnswerMs - right.averageAnswerMs
    })[0]
  }, [match])

  async function roll() {
    if (!match) return
    try {
      const result = await api.kvizopoli.roll(match.id)
      setMatch(result.match)
      if (result.match.currentQuestion) setSelected(result.match.currentQuestion.spaceId)
    } catch (err: any) {
      setError(err.message || 'Bacanje kocke nije uspjelo')
    }
  }

  async function startMatch() {
    if (!match) return
    try {
      setError('')
      const result = await api.kvizopoli.start(match.id)
      setMatch(result.match)
    } catch (err: any) {
      setError(err.message || 'Pokretanje meca nije uspjelo')
    }
  }

  async function answer(answerId: string) {
    if (!match) return
    try {
      const result = await api.kvizopoli.answer(match.id, answerId)
      setMatch(result.match)
    } catch (err: any) {
      setError(err.message || 'Odgovor nije uspio')
    }
  }

  async function inviteUser(targetUserId: string) {
    if (!match) return
    try {
      await api.kvizopoli.invite(match.id, targetUserId)
      setInviteState('Poziv poslan')
      window.setTimeout(() => setInviteState(''), 1800)
    } catch (err: any) {
      setInviteState(err.message || 'Poziv nije uspio')
    }
  }

  async function joinByCode() {
    if (!inviteQuery.trim()) return
    try {
      setError('')
      const result = await api.kvizopoli.join(inviteQuery.trim().toUpperCase())
      setMatch(result.match)
      setInviteOpen(false)
      setParams(prev => {
        const next = new URLSearchParams(prev)
        next.set('code', inviteQuery.trim().toUpperCase())
        return next
      })
    } catch (err: any) {
      setInviteState(err.message || 'Ulazak u sobu nije uspio')
    }
  }

  useEffect(() => {
    if (match?.currentQuestion?.spaceId !== undefined) {
      setSelected(match.currentQuestion.spaceId)
    }
  }, [match?.currentQuestion?.spaceId])

  if (loading) {
    return <div className="min-h-screen grid place-items-center" style={{ background: 'var(--paper)' }}><div className="font-mono text-[12px] opacity-60">Ucitavam Kvizopoli…</div></div>
  }

  if (error && !match) {
    return (
      <div className="min-h-screen grid place-items-center px-4" style={{ background: 'var(--paper)' }}>
        <div className="btl sh-4 p-4 max-w-sm text-center" style={{ background: '#fff' }}>
          <div className="font-display text-[20px]">Kvizopoli</div>
          <div className="font-mono text-[11px] opacity-70 mt-2">{error}</div>
          <button className="btn mt-4" onClick={() => navigate('/')}>Natrag</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col kvizopoli-screen" style={{ backgroundColor: 'var(--paper)' }}>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4 pb-5 relative">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navigate('/')} className="btn btn-sm">
            <Icon name="back" className="w-4 h-4" />
            Natrag
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setRulesOpen(true)} className="kv-rules-button" aria-label="Pravila Kvizopolija">?</button>
            <div className={`kv-leak-timer ${timerPct <= 10 ? 'is-danger' : ''}`}>
              <div className="kv-timer-liquid" style={{ width: `${timerPct}%` }} />
              <span className="kv-timer-drop kv-timer-drop-a" />
              <span className="kv-timer-drop kv-timer-drop-b" />
              <span className="kv-timer-number">{timerText}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="btl p-3 mb-3 font-mono text-[11px] font-bold" style={{ background: '#fecaca', borderColor: '#dc2626' }}>
            {error}
          </div>
        )}

        {match && (
          <>
            <div className="btl btl-lg sh-6 p-4 relative overflow-hidden mb-3" style={{ background: '#baf2d8' }}>
              <div className="absolute inset-0 kvizopoli-grid opacity-90" />
              <div className="kv-time-ribbon">
                <div className="kv-time-ribbon-fill" style={{ width: `${timerPct}%` }} />
              </div>
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>SOBA · {match.players.length}/4</div>
                  <h1 className="font-display text-[38px] leading-none mt-2">Kvizopoli</h1>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-70 mt-2">
                    {isLobby ? 'Lobby otvoren · host pokrece mec' : 'Server vodi poteze, pitanja i vlasnistvo polja'}
                  </div>
                </div>
                <div className="kv-session-code">
                  <div className="font-mono text-[9px] font-bold uppercase opacity-60">Kod sobe</div>
                  <div className="font-display text-[18px] leading-none tabular">{match.joinCode}</div>
                  <button
                    onClick={() => {
                      setInviteMode('join')
                      setInviteOpen(true)
                    }}
                    className="kv-code-button"
                  >
                    Ukucaj KOD
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-3">
              {seatPlayers.map((player, index) => player ? (
                <div key={player.id} className={`btl btl-sm sh-2 p-2 ${match.activePlayerId === player.id ? 'kv-player-active' : ''}`} style={{ background: '#fff' }}>
                  <div className="flex items-center gap-1.5">
                    <span className="kv-player-dot" style={{ background: player.color }} />
                    <span className="font-display text-[13px] leading-none truncate">{player.name}</span>
                  </div>
                  <div className="font-mono text-[10px] font-bold opacity-60 mt-1">{propertyCount(match.boardSpaces, player.id)} POSJ.</div>
                </div>
              ) : (
                <button key={index} onClick={() => { setInviteMode('friends'); setInviteOpen(true) }} className="kv-empty-player">
                  <span>+</span>
                  <small>Pozovi</small>
                </button>
              ))}
            </div>

            <div className="btl sh-5 p-3 mb-3" style={{ background: '#fff' }}>
              <div className="kvizopoli-game-board">
                {match.boardSpaces.map(space => {
                  const owner = match.players.find(player => player.id === space.ownerId)
                  return (
                    <button
                      key={space.id}
                      onClick={() => setSelected(space.id)}
                      className={`kv-board-cell ${space.id === selected ? 'is-selected' : ''}`}
                      style={{ ['--owner' as any]: owner?.color || '#fff8e6' }}
                    >
                      <span>{KVIZOPOLI_TOPICS[space.id % KVIZOPOLI_TOPICS.length]}</span>
                    </button>
                  )
                })}

                {match.players.map(player => {
                  const point = BOARD_POINTS[player.position] || BOARD_POINTS[0]
                  return (
                    <span
                      key={player.id}
                      className={`kv-pawn ${match.activePlayerId === player.id ? 'is-active' : ''}`}
                      style={{ ['--pawn' as any]: player.color, ['--col' as any]: point[0], ['--row' as any]: point[1] }}
                    />
                  )
                })}

                <div className="kv-board-center">
                  {isLobby ? (
                    <div className="kv-question-pop">
                      <div className="chip" style={{ background: 'var(--accent)', color: 'var(--ink)' }}>
                        {match.players.length < 2 ? 'Potrebna 2 igraca' : 'Spremno za start'}
                      </div>
                      <div className="font-display text-[20px] leading-tight mt-2">
                        {isHost ? 'Pokreni mec kad ste spremni.' : 'Cekaj da host pokrene mec.'}
                      </div>
                      <div className="font-mono text-[10px] font-bold uppercase opacity-60 mt-2">
                        Najmanje 2 igraca · nakon starta nitko novi ne moze uci
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => { setInviteMode('friends'); setInviteOpen(true) }} className="btn btn-sm">
                          Pozovi igrace
                        </button>
                        {isHost && (
                          <button onClick={startMatch} disabled={match.players.length < 2} className="btn btn-primary btn-sm">
                            Start match
                          </button>
                        )}
                      </div>
                    </div>
                  ) : match.currentQuestion ? (
                    <div className="kv-question-pop">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="chip" style={{ background: 'var(--accent)', color: 'var(--ink)' }}>
                          {topicLabel(match.currentQuestion.topicId)}
                        </div>
                        <span className="font-mono text-[9px] font-bold opacity-60">
                          POLJE #{String(match.currentQuestion.spaceId + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="font-display text-[17px] leading-tight">{match.currentQuestion.prompt}</div>
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        {match.currentQuestion.answers.map(option => (
                          <button
                            key={option.id}
                            onClick={() => answer(option.id)}
                            disabled={match.activePlayerId !== me?.id || match.status === 'complete'}
                            className="btl btl-sm sh-2 px-2 py-1.5 font-mono text-[10px] font-bold text-left"
                            style={{ background: '#fff' }}
                          >
                            {option.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button onClick={roll} disabled={match.activePlayerId !== me?.id || match.status === 'complete' || isLobby} className="kv-dice-roll">
                      <span className="kv-die" aria-hidden="true">
                        {Array.from({ length: 9 }).map((_, index) => (
                          <i key={index} className={DICE_DOTS[match.currentDiceValue || 1].includes(index) ? 'on' : ''} />
                        ))}
                      </span>
                      <span className="font-mono text-[10px] font-bold uppercase">
                        {match.activePlayerId === me?.id ? 'Baci kocku' : 'Cekaj potez'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatBox label="Tvoj posjed" value={me ? propertyCount(match.boardSpaces, me.id) : 0} />
              <StatBox label="Tocni" value={me?.correctAnswers || 0} />
              <StatBox label="Preuzimanja" value={me?.takeoverCount || 0} />
            </div>
          </>
        )}

        {match?.status === 'complete' && winner && (
          <div className="kv-times-up">
            <div className="kv-winner-panel">
              <div className="kv-winner-burst" />
              <div className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>VRIJEME JE ISTEKLO</div>
              <h2 className="font-display text-[36px] leading-none mt-3">Pobjednik</h2>
              <div className="kv-winner-token" style={{ background: winner.color }} />
              <div className="font-display text-[30px] leading-none mt-2">{winner.name}</div>
              <div className="font-mono text-[12px] font-bold uppercase tracking-widest opacity-70 mt-2">
                {propertyCount(match.boardSpaces, winner.id)} posjeda
              </div>
              <button onClick={() => navigate('/')} className="btn btn-primary mt-5">Natrag na pocetnu</button>
            </div>
          </div>
        )}

        {inviteOpen && (
          <div className="kv-invite-modal">
            <div className="kv-invite-panel">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-display text-[27px] leading-none">{inviteMode === 'join' ? 'Pridruzi se' : 'Pozovi igraca'}</h2>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">
                    {inviteMode === 'join' ? 'Unesi kod sobe' : `Kod ${match?.joinCode || ''}`}
                  </div>
                </div>
                <button onClick={() => setInviteOpen(false)} className="btl btl-sm sh-2 w-10 h-10 grid place-items-center" style={{ background: '#fff' }}>
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>

              {inviteMode === 'join' ? (
                <div>
                  <input className="inp" value={inviteQuery} onChange={event => setInviteQuery(event.target.value.toUpperCase())} placeholder="QZ-4829" />
                  <button className="btn btn-primary w-full mt-3" onClick={joinByCode}>
                    Udi u sobu
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => setInviteMode('friends')} className={`btn btn-sm ${inviteMode === 'friends' ? 'btn-primary' : ''}`}>Prijatelji</button>
                    <button onClick={() => setInviteMode('search')} className={`btn btn-sm ${inviteMode === 'search' ? 'btn-primary' : ''}`}>Trazi korisnike</button>
                  </div>

                  {inviteMode === 'search' && (
                    <input className="inp mb-3" value={inviteQuery} onChange={event => setInviteQuery(event.target.value)} placeholder="Upisi ime korisnika" />
                  )}

                  {inviteState && (
                    <div className="font-mono text-[10px] opacity-60 mb-2">{inviteState}</div>
                  )}

                  <div className="flex flex-col gap-2">
                    {(inviteMode === 'search' ? searchUsers : friends).map(person => (
                      <div key={person.id} className="kv-user-row">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="kv-player-dot" style={{ background: person.online ? '#22c55e' : '#9ca3af' }} />
                          <div className="min-w-0">
                            <div className="font-display text-[16px] leading-none truncate">
                              {`${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email}
                            </div>
                            <div className={`font-mono text-[9px] font-bold uppercase mt-1 ${person.online ? 'text-green-700' : 'opacity-45'}`}>
                              {person.online ? 'online' : 'offline'}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => inviteUser(person.id)} disabled={!person.online || !match} className="btn btn-sm">
                          Pozovi
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {rulesOpen && (
          <div className="kv-rules-modal">
            <div className="kv-rules-panel">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="font-display text-[28px] leading-none">Pravila</h2>
                <button onClick={() => setRulesOpen(false)} className="btl btl-sm sh-2 w-10 h-10 grid place-items-center" style={{ background: '#fff' }}>
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
              <div className="font-mono text-[11px] font-bold uppercase leading-relaxed">
                <p>4 igraca igraju uzivo 10 minuta.</p>
                <p>Baci kocku, pomakni pijuna i odgovori na pitanje teme na koju si sletio.</p>
                <p>Slobodno polje: tocan odgovor osvaja posjed.</p>
                <p>Tudi posjed: tocan odgovor preuzima posjed.</p>
                <p>Tudi posjed: netocan odgovor predaje jedan tvoj posjed vlasniku tog polja.</p>
                <p>Pobjeduje igrac s najvise posjeda kad vrijeme istekne.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const BOARD_POINTS: Array<[number, number]> = [
  [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 5], [0, 4], [0, 3], [0, 2], [0, 1],
]

const DICE_DOTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function topicLabel(topicId: string) {
  const mapping: Record<string, string> = {
    geography: 'Geo',
    film_music: 'Film',
    sports: 'Sport',
    history: 'Pov',
    science: 'Znan',
    pop_culture: 'Pop',
  }
  return mapping[topicId] || KVIZOPOLI_TOPICS[0]
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="btl btl-sm sh-2 p-3" style={{ background: '#fff' }}>
      <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</div>
      <div className="font-display text-[22px] leading-none mt-1">{value}</div>
    </div>
  )
}
