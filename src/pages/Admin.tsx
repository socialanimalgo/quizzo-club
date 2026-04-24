import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoadingOverlay } from '../context/LoadingOverlayContext'
import Icon from '../components/Icon'
import AppHeader from '../components/AppHeader'

interface Stats {
  totalUsers: number
  todayVisits: number
  todayNewUsers: number
  dailyVisits: { date: string; count: number }[]
  dailyNewUsers: { date: string; count: number }[]
  topCountries: { country: string; code: string; count: number }[]
  categoryStats: { name: string; emoji: string; sessions: number; accuracy: number }[]
}

type AdminUser = {
  id: string
  first_name?: string
  last_name?: string
  email: string
  xp?: number
  is_blocked?: boolean
  subscription_status?: string
}

type GiftKind = 'powerup' | 'xp' | 'pro'
type ModalState =
  | { kind: 'actions'; user: AdminUser }
  | { kind: 'gift'; user: AdminUser; giftKind: GiftKind }
  | { kind: 'notify'; user: AdminUser }
  | null

const POWERUPS = [
  { id: 'fifty', label: '50/50' },
  { id: 'freeze', label: 'Freeze' },
  { id: 'doublexp', label: '2x XP' },
  { id: 'reveal', label: 'Reveal' },
] as const

function countryFlag(code: string) {
  if (!code || code.length !== 2) return '🌐'
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}

function userLabel(user: AdminUser) {
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
}

function BarChart({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const days: { date: string; count: number }[] = []

  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const found = data.find(row => row.date?.toString().startsWith(dateStr))
    days.push({ date: dateStr, count: found?.count ?? 0 })
  }

  return (
    <div className="flex items-end gap-[3px] h-32">
      {days.map((day, index) => (
        <div key={index} className="flex-1 flex flex-col items-center gap-1 group relative">
          <div
            className="w-full rounded-t transition-all duration-300 cursor-default"
            style={{
              height: `${(day.count / max) * 100}%`,
              backgroundColor: color,
              minHeight: day.count > 0 ? '4px' : '1px',
              opacity: day.count > 0 ? 1 : 0.2,
            }}
          />
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
            {new Date(day.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}: {day.count}
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  return (
    <div className="btl sh-3 p-4" style={{ background: '#fff' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${color}20` }}>
        <Icon name={icon} className="w-5 h-5" />
      </div>
      <div className="font-display text-[26px] leading-none">{value.toLocaleString()}</div>
      <div className="font-mono text-[10px] opacity-60 mt-1 uppercase tracking-widest">{label}</div>
    </div>
  )
}

function AdminAction({
  icon,
  label,
  tone = 'default',
  onClick,
}: {
  icon: string
  label: string
  tone?: 'default' | 'warn' | 'danger' | 'success'
  onClick: () => void
}) {
  const background =
    tone === 'danger' ? '#fecaca'
      : tone === 'warn' ? '#fde68a'
        : tone === 'success' ? '#bbf7d0'
          : '#fff'

  return (
    <button
      onClick={onClick}
      className="btl btl-sm w-full flex items-center gap-3 p-3"
      style={{ background, borderWidth: 1.5, boxShadow: '2px 2px 0 0 var(--line)' }}
    >
      <Icon name={icon} className="w-4 h-4" />
      <span className="font-display text-[13.5px] flex-1 text-left">{label}</span>
      <Icon name="chev" className="w-3.5 h-3.5 opacity-50" />
    </button>
  )
}

function UserActionModal({
  user,
  onClose,
  onBlock,
  onDelete,
  onGift,
  onNotify,
}: {
  user: AdminUser
  onClose: () => void
  onBlock: () => Promise<void>
  onDelete: () => Promise<void>
  onGift: (kind: GiftKind) => void
  onNotify: () => void
}) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function run(action: () => Promise<void>) {
    try {
      setWorking(true)
      setError('')
      await action()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Akcija nije uspjela')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(17,16,20,0.5)' }} onClick={onClose}>
      <div
        className="w-full btl btl-lg sh-5 p-4"
        style={{ background: '#fff', maxWidth: 430, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="btl btl-sm w-12 h-12 grid place-items-center text-[20px] font-display" style={{ background: 'var(--paper-deep)', borderWidth: 2 }}>
            {userLabel(user).slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-[16px] truncate">{userLabel(user)}</div>
            <div className="font-mono text-[10px] opacity-60 truncate">{user.email}</div>
          </div>
          <button onClick={onClose} className="btl btl-sm w-8 h-8 grid place-items-center" style={{ background: '#fff' }}>
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="btl p-3 mb-3 font-mono text-[11px] font-bold" style={{ background: '#fecaca', borderColor: '#dc2626' }}>
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <AdminAction icon="target" label="Pokloni powerupe" onClick={() => onGift('powerup')} />
          <AdminAction icon="chart" label="Pokloni XP" onClick={() => onGift('xp')} />
          <AdminAction icon="crown" label="Pokloni Pro dane" onClick={() => onGift('pro')} />
          <AdminAction icon="mail" label="Pošalji obavijest" onClick={onNotify} />
          <AdminAction
            icon={user.is_blocked ? 'check' : 'x'}
            label={user.is_blocked ? 'Odblokiraj login' : 'Blokiraj login'}
            tone={user.is_blocked ? 'success' : 'warn'}
            onClick={() => void run(onBlock)}
          />
          <AdminAction icon="x" label={working ? 'Brišem…' : 'Obriši račun'} tone="danger" onClick={() => void run(onDelete)} />
        </div>
      </div>
    </div>
  )
}

function GiftModal({
  user,
  giftKind,
  onClose,
  onSubmit,
}: {
  user: AdminUser
  giftKind: GiftKind
  onClose: () => void
  onSubmit: (payload: { kind: GiftKind; powerup_id?: string; qty: number }) => Promise<void>
}) {
  const [powerupId, setPowerupId] = useState('fifty')
  const [qty, setQty] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const title = giftKind === 'powerup' ? 'Pokloni powerupe' : giftKind === 'xp' ? 'Pokloni XP' : 'Pokloni Pro dane'

  async function submit() {
    try {
      setSaving(true)
      setError('')
      await onSubmit({
        kind: giftKind,
        qty,
        ...(giftKind === 'powerup' ? { powerup_id: powerupId } : {}),
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Akcija nije uspjela')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(17,16,20,0.5)' }} onClick={onClose}>
      <div
        className="w-full btl btl-lg sh-5 p-4"
        style={{ background: '#fff', maxWidth: 430, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-display text-[18px] flex-1">{title}</h2>
          <button onClick={onClose} className="btl btl-sm w-8 h-8 grid place-items-center" style={{ background: '#fff' }}>
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
        <div className="font-mono text-[10px] opacity-60 mb-3">za {userLabel(user)}</div>

        {giftKind === 'powerup' && (
          <>
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">// POWERUP</div>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {POWERUPS.map(powerup => (
                <button
                  key={powerup.id}
                  onClick={() => setPowerupId(powerup.id)}
                  className="btl btl-sm p-2 flex items-center justify-center"
                  style={{
                    background: powerupId === powerup.id ? 'var(--accent)' : '#fff',
                    borderWidth: powerupId === powerup.id ? 2 : 1.5,
                    boxShadow: powerupId === powerup.id ? '2px 2px 0 0 var(--line)' : '1.5px 1.5px 0 0 var(--line)',
                  }}
                >
                  <span className="font-mono text-[10px] font-bold">{powerup.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">// KOLIČINA</div>
        <div className="btl btl-sm sh-2 flex items-center justify-between p-1 mb-4" style={{ background: 'var(--paper-deep)' }}>
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="btl btl-sm w-10 h-10 grid place-items-center" style={{ background: '#fff' }}>
            <span className="font-display text-[18px]">–</span>
          </button>
          <div className="font-display text-[28px] tabular">{qty}</div>
          <button onClick={() => setQty(qty + 1)} className="btl btl-sm w-10 h-10 grid place-items-center" style={{ background: '#fff' }}>
            <span className="font-display text-[18px]">+</span>
          </button>
        </div>

        {error && (
          <div className="btl p-3 mb-3 font-mono text-[11px] font-bold" style={{ background: '#fecaca', borderColor: '#dc2626' }}>
            {error}
          </div>
        )}

        <button onClick={submit} disabled={saving} className="btn btn-primary w-full" style={{ padding: '14px' }}>
          {saving ? '…' : giftKind === 'powerup' ? `Pošalji ${qty}× ${POWERUPS.find(powerup => powerup.id === powerupId)?.label}` : giftKind === 'xp' ? `Pošalji ${qty * 100} XP` : `Pošalji ${qty} dana Pro`}
        </button>
      </div>
    </div>
  )
}

function NotifyModal({
  user,
  onClose,
  onSubmit,
}: {
  user: AdminUser
  onClose: () => void
  onSubmit: (message: string) => Promise<void>
}) {
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    try {
      if (!message.trim()) return
      setSaving(true)
      setError('')
      await onSubmit(message.trim())
      onClose()
    } catch (err: any) {
      setError(err.message || 'Slanje nije uspjelo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(17,16,20,0.5)' }} onClick={onClose}>
      <div
        className="w-full btl btl-lg sh-5 p-4"
        style={{ background: '#fff', maxWidth: 430, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-display text-[18px] flex-1">Pošalji obavijest</h2>
          <button onClick={onClose} className="btl btl-sm w-8 h-8 grid place-items-center" style={{ background: '#fff' }}>
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
        <div className="font-mono text-[10px] opacity-60 mb-3">za {userLabel(user)}</div>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={4}
          placeholder="Poruka korisniku..."
          className="inp mb-3"
          style={{ padding: 10, resize: 'none' }}
        />
        {error && (
          <div className="btl p-3 mb-3 font-mono text-[11px] font-bold" style={{ background: '#fecaca', borderColor: '#dc2626' }}>
            {error}
          </div>
        )}
        <button onClick={submit} disabled={saving || !message.trim()} className="btn btn-primary w-full" style={{ padding: '14px' }}>
          {saving ? '…' : 'Pošalji obavijest'}
        </button>
      </div>
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [powerups, setPowerups] = useState<any>(null)
  const [tab, setTab] = useState<'overview' | 'users' | 'powerups' | 'schedule'>('overview')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)

  // Daily quiz scheduling state
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)); d.setHours(0,0,0,0); return d
  })
  const [weekQuizzes, setWeekQuizzes] = useState<{ date: string; question_count: number; scheduled: boolean }[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayQuestions, setDayQuestions] = useState<any[]>([])
  const [dayLoading, setDayLoading] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [scheduleBusy, setScheduleBusy] = useState(false)
  const [scheduleResult, setScheduleResult] = useState('')
  const [questionSearch, setQuestionSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  useEffect(() => {
    api.auth.getUser().then(user => {
      if (!user || !user.is_admin) {
        navigate('/', { replace: true })
        return
      }
      Promise.all([
        api.admin.getStats(),
        api.admin.users(),
        api.admin.powerups(),
      ])
        .then(([statsData, usersData, powerupsData]) => {
          setStats(statsData)
          setUsers(usersData.users)
          setPowerups(powerupsData)
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    })
  }, [navigate])

  async function refreshUsers(nextQuery = query) {
    const data = await api.admin.users(nextQuery)
    setUsers(data.users)
  }

  async function refreshPowerups() {
    const data = await api.admin.powerups()
    setPowerups(data)
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`Obrisati korisnika ${user.email}?`)) return
    await api.admin.delete(user.id)
    await refreshUsers()
  }

  async function toggleBlock(user: AdminUser) {
    if (user.is_blocked) await api.admin.unblock(user.id)
    else await api.admin.block(user.id)
    await refreshUsers()
  }

  async function gift(user: AdminUser, body: { kind: GiftKind; powerup_id?: string; qty: number }) {
    await api.admin.gift(user.id, body)
    await refreshUsers()
    if (body.kind === 'powerup') await refreshPowerups()
  }

  async function notifyUser(user: AdminUser, message: string) {
    await api.admin.notify(user.id, message)
  }

  // ── Daily quiz scheduling ──────────────────────────────────────

  const DAY_ABBR = ['NED', 'PON', 'UTO', 'SRI', 'ČET', 'PET', 'SUB']

  function weekEndDate(start: Date): Date {
    const d = new Date(start); d.setDate(d.getDate() + 6); return d
  }

  function fmt(d: Date) {
    return d.toISOString().slice(0, 10)
  }

  useEffect(() => {
    if (tab !== 'schedule') return
    const from = fmt(weekStart)
    const to = fmt(weekEndDate(weekStart))
    api.admin.dailyQuizzes(from, to).then(d => setWeekQuizzes(d.quizzes)).catch(() => {})
  }, [tab, weekStart])

  useEffect(() => {
    if (!questionSearch.trim()) { setSearchResults([]); return }
    const t = setTimeout(() => {
      const excluded = dayQuestions.map((q: any) => q.id)
      api.admin.searchQuestions(questionSearch, excluded).then(d => setSearchResults(d.questions)).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [questionSearch, dayQuestions])

  async function selectDay(date: string) {
    if (selectedDate === date) { setSelectedDate(null); return }
    setSelectedDate(date)
    setDayLoading(true)
    setDayQuestions([])
    setQuestionSearch('')
    setSearchResults([])
    setSaveMsg('')
    try {
      const d = await api.admin.dailyQuizDetail(date)
      setDayQuestions(d.questions)
    } finally {
      setDayLoading(false)
    }
  }

  async function saveDay() {
    if (!selectedDate) return
    setSaveBusy(true)
    setSaveMsg('')
    try {
      const r = await api.admin.updateDailyQuiz(selectedDate, dayQuestions.map((q: any) => q.id))
      setSaveMsg(`Spremljeno ${r.count} pitanja`)
      const from = fmt(weekStart); const to = fmt(weekEndDate(weekStart))
      api.admin.dailyQuizzes(from, to).then(d => setWeekQuizzes(d.quizzes)).catch(() => {})
    } catch (err: any) {
      setSaveMsg(err.message || 'Greška')
    } finally {
      setSaveBusy(false)
    }
  }

  async function autoSchedule() {
    setScheduleBusy(true)
    setScheduleResult('')
    try {
      const r = await api.admin.scheduleDailyQuizzes(30)
      setScheduleResult(`Raspoređeno ${r.scheduled} novih dana, ${r.skipped} preskočeno`)
      const from = fmt(weekStart); const to = fmt(weekEndDate(weekStart))
      api.admin.dailyQuizzes(from, to).then(d => setWeekQuizzes(d.quizzes)).catch(() => {})
    } catch (err: any) {
      setScheduleResult(err.message || 'Greška')
    } finally {
      setScheduleBusy(false)
    }
  }

  useLoadingOverlay(loading, { message: 'UČITAVAM ADMIN' })

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

  const totalVisits = stats.dailyVisits.reduce((sum, day) => sum + day.count, 0)
  const totalCountryVisits = stats.topCountries.reduce((sum, country) => sum + country.count, 0)

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <AppHeader />

      <div className="flex-1 overflow-y-auto no-scrollbar max-w-xl mx-auto w-full px-4 py-4 space-y-4 app-scroll-with-nav">
        <div className="btl sh-3 p-1 flex gap-1" style={{ background: '#fff' }}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'users', label: 'Users' },
            { key: 'powerups', label: 'Powerups' },
            { key: 'schedule', label: 'Kvizovi' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as 'overview' | 'users' | 'powerups' | 'schedule')}
              className={`flex-1 py-2 font-mono text-[10px] font-bold uppercase tracking-widest rounded-[10px] ${tab === item.key ? '' : 'opacity-50'}`}
              style={tab === item.key ? { background: 'var(--ink)', color: '#fff', border: '1.5px solid var(--line)' } : {}}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total users" value={stats.totalUsers} icon="user" color="#6366f1" />
              <StatCard label="Visits today" value={stats.todayVisits} icon="target" color="#06b6d4" />
              <StatCard label="New users today" value={stats.todayNewUsers} icon="check" color="#10b981" />
              <StatCard label="Visits 14 days" value={totalVisits} icon="chart" color="#f59e0b" />
            </div>

            <div className="grid gap-4">
              <div className="btl sh-3 p-4" style={{ background: '#fff' }}>
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

              <div className="btl sh-3 p-4" style={{ background: '#fff' }}>
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

            <div className="btl sh-3 p-4" style={{ background: '#fff' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-gray-800">Visitors by Country</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">last 30 days</span>
              </div>
              {stats.topCountries.length === 0 ? (
                <p className="text-gray-400 text-sm">No geographic data yet.</p>
              ) : (
                <div className="space-y-3">
                  {stats.topCountries.map((country, index) => {
                    const pct = totalCountryVisits > 0 ? Math.round((country.count / totalCountryVisits) * 100) : 0
                    return (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-xl w-7 text-center">{countryFlag(country.code)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700 truncate">{country.country}</span>
                            <span className="text-sm text-gray-500 ml-2 shrink-0">{country.count} <span className="text-gray-300">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {stats.categoryStats?.length > 0 && (
              <div className="btl sh-3 p-4" style={{ background: '#fff' }}>
                <h2 className="font-semibold text-gray-800 mb-4">Quiz Categories</h2>
                <div className="space-y-3">
                  {stats.categoryStats.map((category, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="text-xl w-7 text-center">{category.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{category.name}</span>
                          <span className="text-sm text-gray-400">{category.sessions} sesija · {category.accuracy}% točno</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${category.accuracy}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'users' && (
          <div className="btl sh-3 p-4" style={{ background: '#fff' }}>
            <div className="flex gap-2 mb-3">
              <input
                className="inp !text-[12px]"
                placeholder="Traži korisnika"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <button className="btn btn-primary" onClick={() => refreshUsers()}>Traži</button>
            </div>
            <div className="space-y-3">
              {users.map(user => (
                <div key={user.id} className="btl btl-sm p-3" style={{ background: '#fff', boxShadow: '2px 2px 0 0 var(--line)' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 btl btl-sm grid place-items-center font-bold" style={{ background: 'var(--accent-soft)' }}>
                      {userLabel(user).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-[15px]">{userLabel(user)}</div>
                      <div className="font-mono text-[10px] opacity-60 truncate">{user.email}</div>
                      <div className="font-mono text-[10px] opacity-60 mt-1">
                        XP {user.xp || 0} · {user.subscription_status === 'active' ? 'PRO' : 'FREE'} · {user.is_blocked ? 'BLOCKED' : 'ACTIVE'}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button className="btn" onClick={() => setModal({ kind: 'actions', user })}>Upravljaj</button>
                    <button className="btn" onClick={() => setModal({ kind: 'notify', user })}>Obavijest</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'powerups' && powerups && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Units" value={powerups.totals.units} icon="target" color="#06b6d4" />
              <StatCard label="Revenue" value={`€${Number(powerups.totals.revenue_eur || 0).toFixed(2)}`} icon="crown" color="#10b981" />
            </div>
            <div className="btl sh-3 p-4" style={{ background: '#fff' }}>
              <div className="space-y-3">
                {powerups.per_type.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 border-b last:border-0 pb-3 last:pb-0" style={{ borderColor: 'rgba(0,0,0,.08)' }}>
                    <div>
                      <div className="font-display text-[15px]">{item.id}</div>
                      <div className="font-mono text-[10px] opacity-60">Today {item.today}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-[18px]">{item.total}</div>
                      <div className="font-mono text-[10px] opacity-60">€{Number(item.revenue_eur || 0).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'schedule' && (
          <div className="space-y-3">
            {/* Auto-schedule */}
            <div className="btl sh-3 p-4" style={{ background: '#fff' }}>
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60 mb-2">// AUTO-RASPORED</div>
              <p className="font-mono text-[11px] opacity-60 mb-3">Automatski popuni dnevne kvizove za sljedećih 30 dana (preskače dane koji već imaju 30 pitanja).</p>
              <button
                onClick={autoSchedule}
                disabled={scheduleBusy}
                className="btn btn-primary w-full"
              >
                {scheduleBusy ? 'Raspoređujem...' : 'Auto-rasporedi 30 dana'}
              </button>
              {scheduleResult && (
                <div className="mt-2 font-mono text-[11px] font-bold opacity-70">{scheduleResult}</div>
              )}
            </div>

            {/* Week navigator */}
            <div className="btl sh-3 overflow-hidden" style={{ background: '#fff' }}>
              <div className="flex items-center justify-between px-3 py-2.5 border-b-[1.5px]" style={{ borderColor: 'rgba(0,0,0,.08)' }}>
                <button
                  onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); setSelectedDate(null) }}
                  className="btl btl-sm w-8 h-8 grid place-items-center"
                  style={{ background: 'var(--paper)' }}
                >
                  <Icon name="back" className="w-3.5 h-3.5" stroke={2.2} />
                </button>
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest">
                  {weekStart.toLocaleDateString('hr', { day: 'numeric', month: 'short' })}
                  {' – '}
                  {weekEndDate(weekStart).toLocaleDateString('hr', { day: 'numeric', month: 'short' })}
                </div>
                <button
                  onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); setSelectedDate(null) }}
                  className="btl btl-sm w-8 h-8 grid place-items-center"
                  style={{ background: 'var(--paper)', transform: 'scaleX(-1)' }}
                >
                  <Icon name="back" className="w-3.5 h-3.5" stroke={2.2} />
                </button>
              </div>
              <div className="grid grid-cols-7">
                {weekQuizzes.map(day => {
                  const d = new Date(day.date + 'T00:00:00')
                  const isToday = day.date === fmt(new Date())
                  const isSelected = selectedDate === day.date
                  return (
                    <button
                      key={day.date}
                      onClick={() => selectDay(day.date)}
                      className="flex flex-col items-center gap-0.5 py-2.5 border-r-[1.5px] last:border-r-0"
                      style={{
                        borderColor: 'rgba(0,0,0,.06)',
                        background: isSelected ? 'var(--ink)' : isToday ? 'var(--accent-soft)' : undefined,
                        color: isSelected ? '#fff' : undefined,
                      }}
                    >
                      <div className="font-mono text-[8px] font-bold uppercase opacity-60">{DAY_ABBR[d.getDay()]}</div>
                      <div className="font-display text-[17px] leading-none">{d.getDate()}</div>
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-0.5"
                        style={{ background: day.scheduled ? '#22c55e' : 'rgba(0,0,0,.15)' }}
                      />
                      {day.scheduled && (
                        <div className="font-mono text-[8px] opacity-50">{day.question_count}</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected day question editor */}
            {selectedDate && (
              <div className="btl sh-3 overflow-hidden" style={{ background: '#fff' }}>
                <div className="px-3 py-2.5 border-b-[1.5px] flex items-center gap-2" style={{ borderColor: 'rgba(0,0,0,.08)' }}>
                  <div className="flex-1">
                    <div className="font-display text-[15px]">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('hr', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                  <span className="chip">{dayQuestions.length} Q</span>
                  <button
                    onClick={saveDay}
                    disabled={saveBusy}
                    className="btl btl-sm px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest"
                    style={{ background: 'var(--ink)', color: '#fff', borderWidth: 2, boxShadow: '2px 2px 0 0 var(--line)' }}
                  >
                    {saveBusy ? '...' : 'Spremi'}
                  </button>
                </div>

                {saveMsg && (
                  <div className="px-3 py-2 font-mono text-[10px] font-bold" style={{ background: '#bbf7d0', borderBottom: '1px solid #16a34a' }}>
                    {saveMsg}
                  </div>
                )}

                {dayLoading ? (
                  <div className="p-6 font-mono text-[11px] opacity-40 text-center">Učitavam...</div>
                ) : (
                  <>
                    <div className="divide-y" style={{ maxHeight: 280, overflowY: 'auto' }}>
                      {dayQuestions.map((q: any) => (
                        <div key={q.id} className="flex items-center gap-2 px-3 py-2">
                          <span className="text-[14px] shrink-0">{q.category_emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[10.5px] opacity-80" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {q.question}
                            </div>
                          </div>
                          <button
                            onClick={() => setDayQuestions(prev => prev.filter((x: any) => x.id !== q.id))}
                            className="btl btl-sm w-6 h-6 grid place-items-center shrink-0"
                            style={{ background: '#fecaca', borderWidth: 1.5 }}
                          >
                            <Icon name="x" className="w-3 h-3" stroke={2.5} />
                          </button>
                        </div>
                      ))}
                      {dayQuestions.length === 0 && (
                        <div className="p-5 font-mono text-[11px] opacity-40 text-center">Nema pitanja za ovaj dan</div>
                      )}
                    </div>

                    {/* Add questions */}
                    <div className="border-t-[1.5px] p-3" style={{ borderColor: 'rgba(0,0,0,.08)' }}>
                      <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50 mb-2">// DODAJ PITANJE</div>
                      <input
                        value={questionSearch}
                        onChange={e => setQuestionSearch(e.target.value)}
                        placeholder="Pretraži pitanja..."
                        className="w-full btl btl-sm px-3 py-2 font-mono text-[11px]"
                        style={{ background: 'var(--paper)', outline: 'none' }}
                      />
                      {searchResults.length > 0 && (
                        <div className="mt-2 space-y-1" style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {searchResults.map((q: any) => (
                            <button
                              key={q.id}
                              onClick={() => {
                                if (!dayQuestions.find((x: any) => x.id === q.id)) {
                                  setDayQuestions(prev => [...prev, q])
                                }
                                setQuestionSearch('')
                                setSearchResults([])
                              }}
                              className="w-full btl btl-sm flex items-center gap-2 px-2 py-1.5 text-left"
                              style={{ background: 'var(--paper)' }}
                            >
                              <span className="text-[13px] shrink-0">{q.category_emoji}</span>
                              <span className="flex-1 min-w-0 font-mono text-[10px] opacity-80" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {q.question}
                              </span>
                              <Icon name="check" className="w-3.5 h-3.5 shrink-0 opacity-40" stroke={2.5} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {modal?.kind === 'actions' && (
        <UserActionModal
          user={modal.user}
          onClose={() => setModal(null)}
          onBlock={() => toggleBlock(modal.user)}
          onDelete={() => deleteUser(modal.user)}
          onGift={giftKind => setModal({ kind: 'gift', user: modal.user, giftKind })}
          onNotify={() => setModal({ kind: 'notify', user: modal.user })}
        />
      )}

      {modal?.kind === 'gift' && (
        <GiftModal
          user={modal.user}
          giftKind={modal.giftKind}
          onClose={() => setModal(null)}
          onSubmit={payload => gift(modal.user, payload)}
        />
      )}

      {modal?.kind === 'notify' && (
        <NotifyModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSubmit={message => notifyUser(modal.user, message)}
        />
      )}
    </div>
  )
}
