import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

interface Stats {
  totalUsers: number
  todayVisits: number
  todayNewUsers: number
  dailyVisits: { date: string; count: number }[]
  dailyNewUsers: { date: string; count: number }[]
  topCountries: { country: string; code: string; count: number }[]
  categoryStats: { name: string; emoji: string; sessions: number; accuracy: number }[]
}

function countryFlag(code: string) {
  if (!code || code.length !== 2) return '🌐'
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}

function BarChart({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.count), 1)

  // Fill missing days in last 14 days
  const days: { date: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const found = data.find(r => r.date?.toString().startsWith(dateStr))
    days.push({ date: dateStr, count: found?.count ?? 0 })
  }

  return (
    <div className="flex items-end gap-[3px] h-32">
      {days.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
          <div
            className="w-full rounded-t transition-all duration-300 cursor-default"
            style={{
              height: `${(d.count / max) * 100}%`,
              backgroundColor: color,
              minHeight: d.count > 0 ? '4px' : '1px',
              opacity: d.count > 0 ? 1 : 0.2,
            }}
          />
          {/* Tooltip */}
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
            {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}: {d.count}
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3`} style={{ backgroundColor: color + '20' }}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.auth.getUser().then(user => {
      if (!user || !user.is_admin) {
        navigate('/', { replace: true })
        return
      }
      api.admin.getStats()
        .then(setStats)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    })
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  if (!stats) return null

  const totalVisits = stats.dailyVisits.reduce((s, d) => s + d.count, 0)
  const totalCountryVisits = stats.topCountries.reduce((s, c) => s + c.count, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧠</span>
            <div>
              <h1 className="font-bold text-gray-900 text-lg">Admin Dashboard</h1>
              <p className="text-xs text-gray-400">quizzo.club</p>
            </div>
          </div>
          <a href="/" className="text-sm text-indigo-600 hover:underline">← Back to app</a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total users" value={stats.totalUsers} icon="👥" color="#6366f1" />
          <StatCard label="Visits today" value={stats.todayVisits} icon="👁️" color="#06b6d4" />
          <StatCard label="New users today" value={stats.todayNewUsers} icon="✨" color="#10b981" />
          <StatCard label="Visits (14 days)" value={totalVisits} icon="📈" color="#f59e0b" />
        </div>

        {/* Charts row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Daily visits */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Daily Visits</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">last 14 days</span>
            </div>
            <BarChart data={stats.dailyVisits} color="#6366f1" />
            <div className="flex justify-between mt-2">
              <span className="text-[11px] text-gray-400">
                {new Date(Date.now() - 13 * 86400000).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-[11px] text-gray-400">Today</span>
            </div>
          </div>

          {/* New users */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">New Users</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">last 14 days</span>
            </div>
            <BarChart data={stats.dailyNewUsers} color="#10b981" />
            <div className="flex justify-between mt-2">
              <span className="text-[11px] text-gray-400">
                {new Date(Date.now() - 13 * 86400000).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-[11px] text-gray-400">Today</span>
            </div>
          </div>
        </div>

        {/* Countries */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-800">Visitors by Country</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">last 30 days</span>
          </div>
          {stats.topCountries.length === 0 ? (
            <p className="text-gray-400 text-sm">No geographic data yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.topCountries.map((c, i) => {
                const pct = totalCountryVisits > 0 ? Math.round((c.count / totalCountryVisits) * 100) : 0
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xl w-7 text-center">{countryFlag(c.code)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 truncate">{c.country}</span>
                        <span className="text-sm text-gray-500 ml-2 shrink-0">{c.count} <span className="text-gray-300">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Category stats */}
        {stats.categoryStats?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">Quiz Categories</h2>
            <div className="space-y-3">
              {stats.categoryStats.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xl w-7 text-center">{c.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{c.name}</span>
                      <span className="text-sm text-gray-400">{c.sessions} sesija · {c.accuracy}% točno</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${c.accuracy}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
