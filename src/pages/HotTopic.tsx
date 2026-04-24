import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import AppHeader from '../components/AppHeader'
import Icon from '../components/Icon'
import { HOT_TOPIC } from '../data/categories'
import { useLoadingOverlay } from '../context/LoadingOverlayContext'

const PODIUM_TONES = ['#fde68a', '#e5e7eb', '#fed7aa']
const PODIUM_ORDER = [1, 0, 2]

function formatCountdown(target: string) {
  const diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return 'Uskoro'
  const totalMinutes = Math.floor(diff / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  return `${hours}h ${minutes}m`
}

function formatName(row: any) {
  if (row?.username) return `@${row.username}`
  return [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim() || 'Igrač'
}

function initials(row: any) {
  const first = row?.first_name?.[0] || ''
  const last = row?.last_name?.[0] || ''
  return (first + last || 'Q').toUpperCase()
}

export default function HotTopic() {
  const { slug = HOT_TOPIC.id } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'weekly' | 'daily'>('weekly')
  const [meta, setMeta] = useState<any>(null)
  const [board, setBoard] = useState<Record<'weekly' | 'daily', any[]>>({ weekly: [], daily: [] })
  const [me, setMe] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    Promise.all([
      api.hotTopics.get(slug),
      api.hotTopics.leaderboard(slug, 'weekly', 10),
      api.hotTopics.leaderboard(slug, 'daily', 10),
      api.hotTopics.me(slug).catch(() => ({ me: null })),
    ])
      .then(([metaRes, weeklyRes, dailyRes, meRes]) => {
        if (cancelled) return
        setMeta(metaRes.hot_topic)
        setBoard({ weekly: weeklyRes.leaderboard || [], daily: dailyRes.leaderboard || [] })
        setMe(meRes.me || null)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message || 'Greška pri učitavanju hot topica')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  const leaderboard = board[tab] || []
  const podium = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)
  const countdown = useMemo(() => meta?.weekly_cutoff ? formatCountdown(meta.weekly_cutoff) : '', [meta?.weekly_cutoff])
  const weeklyStanding = me?.weekly

  useLoadingOverlay(loading || starting, { message: starting ? 'PRIPREMAM KVIZ' : 'TRAŽIM NAJBOLJE' })

  async function startQuiz() {
    try {
      setStarting(true)
      setError('')
      const fresh = await api.hotTopics.get(slug)
      if (fresh.hot_topic?.status !== 'active') throw new Error('Ovaj hot topic više nije aktivan')
      const data = await api.hotTopics.start(slug)
      navigate('/quiz/play', {
        state: {
          session: {
            session_id: data.session_id,
            questions: data.questions,
            category_id: fresh.hot_topic.category_id,
          },
          hotTopic: {
            slug,
            title: fresh.hot_topic.title,
            reward_gems: fresh.hot_topic.reward_gems,
            badge_title: fresh.hot_topic.badge_title,
          },
          categoryLabel: fresh.hot_topic.title?.toUpperCase() || 'HOT TOPIC',
          returnTo: `/hot-topics/${slug}`,
        },
      })
    } catch (err: any) {
      setError(err.message || 'Pokretanje kviza nije uspjelo')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <AppHeader />
      <div className="flex-1 overflow-y-auto no-scrollbar app-scroll-with-nav overflow-x-hidden">
        <div className="max-w-xl mx-auto px-4 py-4">
          <button onClick={() => navigate('/')} className="btn mb-4" style={{ minWidth: 148 }}>
            <Icon name="arrow-left" className="w-4 h-4" stroke={2.5} />
            Natrag
          </button>

          {loading ? (
            <div className="space-y-3">
              <div className="btl sh-6 h-[360px] animate-pulse" style={{ background: '#fff' }} />
              <div className="btl sh-4 h-72 animate-pulse" style={{ background: '#fff' }} />
            </div>
          ) : error ? (
            <div className="btl sh-4 p-5 text-center" style={{ background: '#fff' }}>
              <div className="font-display text-[18px] mb-2">{error}</div>
              <button onClick={() => navigate('/')} className="btn btn-primary">Početna</button>
            </div>
          ) : meta && (
            <>
              <div className="btl btl-lg sh-6 mb-4 overflow-hidden relative" style={{ minHeight: 420, background: '#fff' }}>
                <img src={meta.image_url || HOT_TOPIC.image} alt={meta.title} className="hot-topic-image" />
                <div className="absolute inset-0 hot-topic-scrim" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[rgba(255,248,230,0.84)]" />
                <div className="relative p-5 md:p-6 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-5">
                      <div className="chip" style={{ background: 'var(--ink)', color: '#fff', padding: '7px 16px', borderRadius: 999 }}>
                        ★ HOT TOPIC
                      </div>
                      <div className="text-right font-mono text-[11px] font-bold uppercase tracking-[0.22em] leading-6">
                        Reset · Nedjelja · 20:00<br />Zagreb
                      </div>
                    </div>

                    <div className="font-display text-[50px] md:text-[58px] leading-[0.9] tracking-tight mb-4">{meta.title}</div>
                    <div className="max-w-[420px] font-mono text-[12px] md:text-[13px] font-bold uppercase tracking-[0.18em] leading-[1.55] mb-6">
                      Hot topic kviz boduje XP za igru i zasebne bodove za tjednu ljestvicu.
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-w-[520px]">
                    <div className="btl sh-4 p-4 md:p-5" style={{ background: 'rgba(255,255,255,0.92)' }}>
                      <div className="font-mono text-[10px] md:text-[11px] font-bold uppercase tracking-[0.24em] opacity-60 mb-2">XP za igru</div>
                      <div className="font-display text-[32px] md:text-[40px] leading-none">+{HOT_TOPIC.rewardXp} XP</div>
                    </div>
                    <div className="btl sh-4 p-4 md:p-5" style={{ background: 'rgba(253,230,138,0.92)' }}>
                      <div className="font-mono text-[10px] md:text-[11px] font-bold uppercase tracking-[0.24em] opacity-60 mb-2">Nagrada tjedna</div>
                      <div className="font-display text-[32px] md:text-[40px] leading-none">{meta.reward_gems} GEMS</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="btl sh-3 p-4 md:p-5" style={{ background: '#fff' }}>
                  <div className="font-mono text-[10px] md:text-[11px] font-bold uppercase tracking-[0.24em] opacity-60 mb-3">Tvoj tjedan</div>
                  <div className="font-display text-[34px] md:text-[40px] leading-none mb-2">{weeklyStanding?.rank ? `#${weeklyStanding.rank}` : '—'}</div>
                  <div className="font-mono text-[11px] opacity-70">{weeklyStanding?.points || 0} bodova</div>
                </div>
                <div className="btl sh-3 p-4 md:p-5" style={{ background: '#fff' }}>
                  <div className="font-mono text-[10px] md:text-[11px] font-bold uppercase tracking-[0.24em] opacity-60 mb-3">Značka</div>
                  <div className="font-display text-[22px] md:text-[28px] leading-tight mb-2">{meta.badge_title || 'Bez značke'}</div>
                  <div className="font-mono text-[11px] opacity-70">Top 3 tjedna</div>
                </div>
              </div>

              <div className="btl btl-lg sh-4 p-3 mb-4" style={{ background: '#fff' }}>
                <div className="flex gap-1 mb-4">
                  {(['weekly', 'daily'] as const).map(period => (
                    <button
                      key={period}
                      onClick={() => setTab(period)}
                      className="flex-1 py-3 rounded-[18px] font-mono text-[11px] md:text-[12px] font-bold uppercase tracking-[0.22em]"
                      style={tab === period ? { background: 'var(--ink)', color: '#fff', border: '2px solid var(--line)' } : { opacity: 0.45 }}
                    >
                      {period === 'weekly' ? 'Tjedno' : 'Dnevno'}
                    </button>
                  ))}
                </div>

                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="font-display text-[24px] md:text-[28px] leading-none mb-2">Ljestvica za ovaj kviz</div>
                    <div className="font-mono text-[11px] md:text-[12px] font-bold uppercase tracking-[0.22em] opacity-60 leading-6">
                      Top 3 igrača · bodovi vrijede samo za {meta.title}
                    </div>
                  </div>
                  <div className="chip shrink-0" style={{ background: 'var(--accent)', color: 'var(--ink)' }}>
                    {tab === 'weekly' ? 'TJEDAN' : 'DANAS'}
                  </div>
                </div>

                {podium.length > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-4 items-end">
                      {PODIUM_ORDER.map((order, visualIndex) => {
                        const row = podium[order]
                        if (!row) return <div key={visualIndex} />
                        const height = order === 0 ? 150 : order === 1 ? 118 : 96
                        return (
                          <div key={row.user_id} className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 btl btl-sm sh-2 grid place-items-center font-mono text-[14px] font-bold mb-2" style={{ background: '#fff' }}>
                              {initials(row)}
                            </div>
                            <div className="font-display text-[14px] truncate w-full">{formatName(row)}</div>
                            <div className="font-mono text-[10px] opacity-60 tabular mb-1">{row.points} pt</div>
                            <div className="btl sh-3 w-full grid place-items-center p-2" style={{ background: PODIUM_TONES[order], height }}>
                              <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">#{row.rank}</div>
                              <div className="font-display text-[26px] leading-none tabular">{row.points}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {rest.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {rest.map((row: any) => (
                          <div key={row.user_id} className="btl btl-sm flex items-center gap-3 px-3 py-3" style={{ background: '#fafaf9', boxShadow: '3px 3px 0 0 var(--line)' }}>
                            <div className="w-8 h-8 btl btl-sm grid place-items-center font-mono text-[11px] font-bold tabular" style={{ background: '#fff' }}>#{row.rank}</div>
                            <div className="w-9 h-9 btl btl-sm grid place-items-center font-mono text-[11px] font-bold" style={{ background: '#fff' }}>{initials(row)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="font-display text-[14px] truncate">{formatName(row)}</div>
                              <div className="font-mono text-[10px] opacity-60">{row.total_correct} točnih · {Math.round((row.total_time_ms || 0) / 1000)}s</div>
                            </div>
                            <div className="font-mono text-[12px] font-bold tabular">{row.points} pt</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="btl sh-2 py-10 px-4 text-center" style={{ background: '#fffdf5' }}>
                    <div className="flex justify-center mb-3"><Icon name="chart" className="w-10 h-10" stroke={2.1} /></div>
                    <div className="font-display text-[18px] mb-2">Još nema rezultata.</div>
                    <div className="font-mono text-[11px] opacity-60 max-w-[280px] mx-auto">Budi prvi na {tab === 'weekly' ? 'tjednoj' : 'dnevnoj'} ljestvici.</div>
                  </div>
                )}
              </div>

              <button onClick={startQuiz} disabled={starting} className="btn btn-primary w-full" style={{ padding: '16px', fontSize: 16 }}>
                {starting ? 'Pokrećem…' : `Igraj ${meta.title} →`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
