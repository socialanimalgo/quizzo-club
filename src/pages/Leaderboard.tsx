import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import Icon from '../components/Icon'
import AppHeader from '../components/AppHeader'

type Tab = 'alltime' | 'weekly' | 'daily'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'alltime', label: 'Sve vrijeme', icon: 'crown' },
  { key: 'weekly',  label: 'Tjedan',      icon: 'scroll' },
  { key: 'daily',   label: 'Danas',       icon: 'chart' },
]

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((searchParams.get('type') as Tab) || 'alltime')
  const [data, setData] = useState<{ leaderboard: any[]; my_rank: any }>({ leaderboard: [], my_rank: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.leaderboard.get(tab).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [tab])

  function score(row: any) {
    if (tab === 'alltime') return `${row.xp ?? 0} XP`
    if (tab === 'weekly') return `${row.total_score ?? 0} pt`
    return `${row.score ?? 0} pt`
  }

  function sub(row: any) {
    if (tab === 'alltime') return `${row.total_quizzes ?? 0} kvizova`
    if (tab === 'weekly') return `${row.quizzes_played ?? 0} kvizova`
    return `${row.correct_count ?? 0}/10 točnih`
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <AppHeader />

      <div className="flex-1 overflow-y-auto no-scrollbar max-w-xl mx-auto px-4 py-4 w-full app-scroll-with-nav">
        {/* Tabs */}
        <div className="btl sh-3 p-1 flex gap-1 mb-4" style={{ background: '#fff' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 font-mono text-[10px] font-bold uppercase tracking-widest rounded-[10px] flex items-center justify-center gap-1 ${tab === t.key ? '' : 'opacity-50'}`}
              style={tab === t.key ? { background: 'var(--ink)', color: '#fff', border: '1.5px solid var(--line)' } : {}}
            >
              <Icon name={t.icon} className="w-3 h-3" stroke={2.2} /> {t.label}
            </button>
          ))}
        </div>

        {/* My rank banner */}
        {data.my_rank && Number(data.my_rank.rank) > 50 && (
          <div className="btl sh-4 p-3 flex items-center gap-3 mb-4" style={{ background: 'var(--accent)' }}>
            <div className="w-9 h-9 btl btl-sm grid place-items-center font-mono font-bold text-[12px] tabular" style={{ background: '#fff', borderWidth: 2 }}>
              {data.my_rank.rank}
            </div>
            <div className="w-8 h-8 btl btl-sm grid place-items-center font-bold text-sm" style={{ background: '#fff' }}>
              {data.my_rank.first_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="font-display text-[14px]">{data.my_rank.first_name}</div>
              <div className="font-mono text-[10px] opacity-70">{sub(data.my_rank)}</div>
            </div>
            <span className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>TI</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="btl h-16 animate-pulse" style={{ background: '#fff' }} />
            ))}
          </div>
        ) : data.leaderboard.length === 0 ? (
          <div className="btl sh-3 p-8 text-center" style={{ background: '#fff' }}>
            <div className="mb-2 flex justify-center"><Icon name="chart" className="w-10 h-10" stroke={2.1} /></div>
            <div className="font-display text-[16px]">Nema podataka još.</div>
            {tab === 'daily' && <div className="font-mono text-[10px] opacity-60 mt-1">Budi prvi koji će riješiti dnevni kviz!</div>}
          </div>
        ) : (
          <>
            {/* Podium top 3 */}
            {data.leaderboard.length >= 3 && (
              <div className="grid grid-cols-3 gap-2 mb-4 items-end">
                {[1, 0, 2].map((order, viz) => {
                  const row = data.leaderboard[order]
                  if (!row) return <div key={viz} />
                  const h = viz === 1 ? 110 : viz === 0 ? 84 : 72
                  const bg = order === 0 ? '#fde68a' : order === 1 ? '#e5e7eb' : '#fed7aa'
                  return (
                    <div key={order} className="flex flex-col items-center">
                      <div className="font-display text-[13px] mt-1 text-center truncate w-full">
                        {row.first_name}
                      </div>
                      <div className="font-mono text-[10px] font-bold tabular opacity-70">{score(row)}</div>
                      <div className="btl sh-3 w-full mt-1.5 grid place-items-center anim-slideup" style={{ background: bg, height: h }}>
                        <div className="text-[20px]">{MEDALS[order]}</div>
                        <div className="font-display text-[16px] leading-none">#{Number(row.rank ?? order + 1)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Rest of the list */}
            <div className="btl sh-3 p-2" style={{ background: '#fff' }}>
              <div className="flex flex-col gap-1">
                {data.leaderboard.slice(data.leaderboard.length >= 3 ? 3 : 0).map((row, i) => {
                  const rank = Number(row.rank ?? i + 4)
                  const isMe = data.my_rank?.user_id === row.user_id
                  return (
                    <div
                      key={row.user_id}
                      className="flex items-center gap-3 p-2 rounded-[10px] anim-slidein"
                      style={{
                        animationDelay: `${i * 0.03}s`,
                        background: isMe ? 'var(--accent-soft)' : 'transparent'
                      }}
                    >
                      <div className="w-7 h-7 btl btl-sm grid place-items-center font-mono text-[11px] font-bold tabular" style={{ background: 'var(--paper-deep)', borderWidth: 1.5 }}>
                        {rank}
                      </div>
                      <div className="w-8 h-8 btl btl-sm grid place-items-center font-bold text-sm" style={{ background: isMe ? 'var(--accent)' : '#fff', borderWidth: 1.5 }}>
                        {row.first_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-[13px] truncate">
                          {row.first_name} {row.last_name}
                          {isMe && <span className="font-mono text-[9px] opacity-60 ml-1">(ti)</span>}
                        </div>
                        <div className="font-mono text-[10px] opacity-60">{sub(row)}</div>
                      </div>
                      <div className="font-mono text-[12px] font-bold tabular">{score(row)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
