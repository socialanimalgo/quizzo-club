import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'

type Tab = 'alltime' | 'weekly' | 'daily'

const tabLabels: Record<Tab, string> = {
  alltime: '🏆 Svo vrijeme',
  weekly:  '📅 Ovaj tjedan',
  daily:   '☀️ Danas',
}

function getFlag(name: string) {
  // Simple avatar placeholder using initials
  return name?.charAt(0)?.toUpperCase() || '?'
}

export default function Leaderboard() {
  const [searchParams] = useSearchParams()
  const defaultTab = (searchParams.get('type') as Tab) || 'alltime'
  const [tab, setTab] = useState<Tab>(defaultTab)
  const [data, setData] = useState<{ leaderboard: any[]; my_rank: any }>({ leaderboard: [], my_rank: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.leaderboard.get(tab)
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tab])

  function displayScore(row: any) {
    if (tab === 'alltime') return `${row.xp ?? 0} XP`
    if (tab === 'weekly') return `${row.total_score ?? 0} pt`
    return `${row.score ?? 0} pt`
  }

  function displaySub(row: any) {
    if (tab === 'alltime') return `${row.total_quizzes ?? 0} kvizova`
    if (tab === 'weekly') return `${row.total_correct ?? 0} točnih`
    return `${row.correct_count ?? 0}/10 točnih`
  }

  const medal = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-gray-950/80 backdrop-blur border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-white/40 hover:text-white/70 transition-colors">←</Link>
          <h1 className="text-white font-black text-lg">Top lista</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white/5 rounded-2xl p-1">
          {(Object.keys(tabLabels) as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>

        {/* My rank (if not in top 50) */}
        {data.my_rank && Number(data.my_rank.rank) > 50 && (
          <div className="mb-4 p-4 rounded-2xl bg-indigo-600/20 border border-indigo-500/30">
            <div className="flex items-center gap-3">
              <span className="text-white/40 font-bold text-lg w-8">#{data.my_rank.rank}</span>
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                {getFlag(data.my_rank.first_name)}
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold text-sm">{data.my_rank.first_name} {data.my_rank.last_name} <span className="text-indigo-300 text-xs">(Ti)</span></div>
                <div className="text-white/40 text-xs">{displaySub(data.my_rank)}</div>
              </div>
              <div className="text-indigo-300 font-bold text-sm">{displayScore(data.my_rank)}</div>
            </div>
          </div>
        )}

        {/* Leaderboard list */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : data.leaderboard.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-white/40">Nema podataka za ovaj period.</p>
            {tab === 'daily' && <p className="text-white/30 text-sm mt-1">Budi prvi koji će riješiti dnevni kviz danas!</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {data.leaderboard.map((row, i) => {
              const rank = Number(row.rank ?? i + 1)
              const isMe = data.my_rank?.user_id === row.user_id
              return (
                <div
                  key={row.user_id}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    rank <= 3
                      ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border-yellow-500/20'
                      : isMe
                      ? 'bg-indigo-600/15 border-indigo-500/30'
                      : 'bg-white/3 border-white/5'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center">
                    {medal(rank) || (
                      <span className="text-white/30 font-bold text-sm">#{rank}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                    rank === 1 ? 'bg-yellow-500 text-yellow-900'
                    : rank === 2 ? 'bg-gray-400 text-gray-800'
                    : rank === 3 ? 'bg-amber-600 text-amber-100'
                    : 'bg-white/10 text-white/60'
                  }`}>
                    {row.avatar_url
                      ? <img src={row.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                      : getFlag(row.first_name)
                    }
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm truncate">
                      {row.first_name} {row.last_name}
                      {isMe && <span className="text-indigo-300 text-xs ml-1">(Ti)</span>}
                    </div>
                    <div className="text-white/40 text-xs">{displaySub(row)}</div>
                  </div>

                  {/* Score */}
                  <div className={`font-bold text-sm tabular-nums ${rank <= 3 ? 'text-yellow-300' : 'text-indigo-300'}`}>
                    {displayScore(row)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
