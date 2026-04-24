import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import AppHeader from '../components/AppHeader'
import Icon from '../components/Icon'
import { HOT_TOPIC } from '../data/categories'

const PODIUM_TONES = ['#fde68a', '#e5e7eb', '#fed7aa']

function formatCountdown(target: string) {
  const diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return 'Zatvara se uskoro'
  const totalMinutes = Math.floor(diff / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  return `${hours}h ${minutes}m`
}

function formatName(row: any) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Igrač'
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
  const currentStanding = me?.[tab]

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
      <div className="flex-1 overflow-y-auto no-scrollbar app-scroll-with-nav">
        <div className="max-w-xl mx-auto px-4 py-4">
          {loading ? (
            <div className="space-y-3">
              <div className="btl sh-5 h-56 animate-pulse" style={{ background: '#fff' }} />
              <div className="btl sh-4 h-64 animate-pulse" style={{ background: '#fff' }} />
            </div>
          ) : error ? (
            <div className="btl sh-4 p-5 text-center" style={{ background: '#fff' }}>
              <div className="font-display text-[18px] mb-2">{error}</div>
              <button onClick={() => navigate('/')} className="btn btn-primary">Početna</button>
            </div>
          ) : meta && (
            <>
              <div className="btl btl-lg sh-6 p-4 mb-4 overflow-hidden relative" style={{ background: '#fff' }}>
                <div className="absolute inset-y-0 right-0 w-[42%] opacity-20" style={{ background: `url(${meta.image_url || HOT_TOPIC.image}) center/cover no-repeat` }} />
                <div className="relative pr-24">
                  <div className="chip mb-3" style={{ background: 'var(--ink)', color: '#fff' }}>HOT TOPIC</div>
                  <div className="font-display text-[30px] leading-none tracking-tight mb-2">{meta.title}</div>
                  <div className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] opacity-60 mb-3">
                    {meta.question_count} pitanja · posebna ljestvica bodova
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <div className="btl btl-sm px-3 py-2" style={{ background: '#fde68a' }}>
                      <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">Tjedni cutoff</div>
                      <div className="font-display text-[16px]">{countdown}</div>
                    </div>
                    <div className="btl btl-sm px-3 py-2" style={{ background: '#ddd6fe' }}>
                      <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">Nagrada</div>
                      <div className="font-display text-[16px]">Top 3 · {meta.reward_gems} gems</div>
                    </div>
                  </div>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">
                    XP ulazi u profil · hot topic bodovi ostaju odvojeni
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="btl sh-3 p-4" style={{ background: '#fff' }}>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Tvoj tjedan</div>
                  <div className="font-display text-[32px] leading-none">{currentStanding?.rank ? `#${currentStanding.rank}` : '—'}</div>
                  <div className="font-mono text-[11px] opacity-70 mt-2">{currentStanding?.points || 0} bodova</div>
                </div>
                <div className="btl sh-3 p-4" style={{ background: '#fff' }}>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Značka</div>
                  <div className="font-display text-[18px] leading-tight">{meta.badge_title || 'Nema'}</div>
                  <div className="font-mono text-[11px] opacity-70 mt-2">Top 3 tjedna</div>
                </div>
              </div>

              <div className="btl sh-4 p-3 mb-4" style={{ background: '#fff' }}>
                <div className="flex gap-1 mb-3">
                  {(['weekly', 'daily'] as const).map(period => (
                    <button
                      key={period}
                      onClick={() => setTab(period)}
                      className="flex-1 py-2 rounded-[10px] font-mono text-[10px] font-bold uppercase tracking-widest"
                      style={tab === period ? { background: 'var(--ink)', color: '#fff', border: '1.5px solid var(--line)' } : { opacity: 0.55 }}
                    >
                      {period === 'weekly' ? 'Tjedno' : 'Danas'}
                    </button>
                  ))}
                </div>

                {podium.length > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-3 items-end">
                      {[1, 0, 2].map((order, index) => {
                        const row = podium[order]
                        if (!row) return <div key={index} />
                        const height = order === 0 ? 118 : order === 1 ? 92 : 76
                        return (
                          <div key={row.user_id} className="text-center">
                            <div className="font-display text-[13px] truncate">{row.first_name}</div>
                            <div className="font-mono text-[10px] opacity-60 tabular">{row.points} pt</div>
                            <div className="btl sh-3 mt-1.5 grid place-items-center" style={{ background: PODIUM_TONES[order], height }}>
                              <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">#{row.rank}</div>
                              <div className="font-display text-[18px] leading-none">{row.points}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex flex-col gap-2">
                      {rest.map((row: any) => (
                        <div key={row.user_id} className="btl btl-sm flex items-center gap-3 px-3 py-3" style={{ background: '#fafaf9', boxShadow: '3px 3px 0 0 var(--line)' }}>
                          <div className="w-8 h-8 btl btl-sm grid place-items-center font-mono text-[11px] font-bold tabular" style={{ background: '#fff' }}>#{row.rank}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-display text-[14px] truncate">{formatName(row)}</div>
                            <div className="font-mono text-[10px] opacity-60">{row.total_correct} točnih · {Math.round((row.total_time_ms || 0) / 1000)}s</div>
                          </div>
                          <div className="font-mono text-[12px] font-bold tabular">{row.points} pt</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <div className="flex justify-center mb-2"><Icon name="chart" className="w-10 h-10" stroke={2.1} /></div>
                    <div className="font-display text-[16px]">Još nema rezultata.</div>
                    <div className="font-mono text-[10px] opacity-60 mt-1">Budi prvi na {tab === 'weekly' ? 'tjednoj' : 'dnevnoj'} ljestvici.</div>
                  </div>
                )}
              </div>

              <button onClick={startQuiz} disabled={starting} className="btn btn-primary w-full mb-3" style={{ padding: '16px', fontSize: 16 }}>
                {starting ? 'Pokrećem…' : `Igraj ${meta.title} →`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
