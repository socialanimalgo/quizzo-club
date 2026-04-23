import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import QuizzoLogo from '../components/QuizzoLogo'

const CATEGORIES = [
  { id: 'geography',   emoji: '🌍', name: 'Geografija',      hue: 220, count: 72 },
  { id: 'history',     emoji: '📚', name: 'Povijest',        hue: 35,  count: 68 },
  { id: 'sports',      emoji: '⚽', name: 'Sport',           hue: 150, count: 64 },
  { id: 'science',     emoji: '🔬', name: 'Priroda i Znan.', hue: 280, count: 70 },
  { id: 'film_music',  emoji: '🎬', name: 'Film i Glazba',   hue: 345, count: 66 },
  { id: 'pop_culture', emoji: '🎭', name: 'Pop Kultura',     hue: 25,  count: 60 },
]

const WELCOME_TILES = [
  { emoji: '🌍', hue: 220 }, { emoji: '📚', hue: 35 },  { emoji: '⚽', hue: 150 },
  { emoji: '🔬', hue: 280 }, { emoji: '🎬', hue: 345 }, { emoji: '🎭', hue: 25 },
]

export default function Home() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dailyDone, setDailyDone] = useState(false)
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})
  const [myRank, setMyRank] = useState<any>(null)
  const [liveCount, setLiveCount] = useState(2847)

  useEffect(() => {
    api.auth.getUser().then(u => {
      setUser(u)
      setLoading(false)
      if (u) {
        api.quiz.daily().then(d => setDailyDone(d.already_completed)).catch(() => {})
        api.leaderboard.get('alltime').then(d => setMyRank(d.my_rank)).catch(() => {})
      }
    })
    api.quiz.categories().then(r => {
      const counts: Record<string, number> = {}
      r.categories.forEach((c: any) => { counts[c.id] = c.question_count || 60 })
      setQuestionCounts(counts)
    }).catch(() => {})
    const i = setInterval(() => setLiveCount(c => c + (Math.random() < 0.6 ? 1 : -1)), 2000)
    return () => clearInterval(i)
  }, [])

  if (loading) return null

  // ── WELCOME SCREEN (logged out) ─────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)' }}>
        {/* Dark hero */}
        <div className="relative overflow-hidden px-5 pt-10 pb-8" style={{ background: 'var(--ink)', color: '#fff' }}>
          <div className="absolute inset-0 grid-dots opacity-[0.15]" />
          <div className="relative flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <QuizzoLogo size={36} />
              <div>
                <div className="font-display text-[17px] leading-none">Quizzo<span style={{ color: 'var(--accent)' }}>.</span></div>
                <div className="font-mono text-[8.5px] opacity-60 uppercase tracking-[0.25em] mt-0.5">CLUB</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest opacity-80">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
              LIVE · {liveCount.toLocaleString()}
            </div>
          </div>
          <div className="relative">
            <div className="font-display text-[46px] leading-[0.92] tracking-tight" style={{ whiteSpace: 'pre-line' }}>
              {'Opće znanje.\nDnevna doza.'}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60 mt-3">
              // HRVATSKI KVIZ · 2026
            </div>
          </div>
          <div className="relative mt-6 flex gap-2 justify-center">
            {WELCOME_TILES.map((tile, i) => (
              <div key={i} className="btl shrink-0 grid place-items-center anim-bob"
                style={{
                  width: 44, height: 44,
                  background: `oklch(0.88 0.12 ${tile.hue})`,
                  animationDelay: `${i * 0.15}s`,
                  transform: `rotate(${(i % 2 ? -1 : 1) * (3 + i)}deg)`,
                  boxShadow: '2.5px 2.5px 0 0 var(--accent)',
                  borderColor: '#fff',
                }}>
                <span className="text-[22px]">{tile.emoji}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 pt-6 pb-5">
          <div className="space-y-3 mb-6">
            {[
              { n: '01', label: '6 kategorija, 360+ pitanja' },
              { n: '02', label: 'Izazovi protiv prijatelja' },
              { n: '03', label: 'Ljestvica cijele Hrvatske' },
            ].map((b, i) => (
              <div key={b.n} className="flex items-center gap-3 anim-slidein" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="btl btl-sm w-11 h-11 grid place-items-center shrink-0 font-mono font-bold text-[12px]"
                  style={{ background: 'var(--accent)' }}>{b.n}</div>
                <div className="font-display text-[15px] leading-tight">{b.label}</div>
              </div>
            ))}
          </div>

          <button onClick={() => navigate('/signup')} className="btn btn-primary w-full mb-2"
            style={{ padding: '16px', fontSize: 16 }}>
            Stvori račun →
          </button>
          <button onClick={() => navigate('/signin')} className="btn w-full mb-4"
            style={{ padding: '13px', fontSize: 14 }}>
            Već imam račun
          </button>
          <div className="text-center">
            <button onClick={() => navigate('/daily')}
              className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-50 underline">
              NASTAVI KAO GOST
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── HOME SCREEN (logged in) ─────────────────────────────────────
  const day = new Date().getDate()
  const xp = myRank?.xp ?? 0
  const rank = myRank?.rank ?? '–'

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      {/* TopBar */}
      <header className="px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QuizzoLogo size={34} />
            <div className="leading-tight">
              <div className="font-display text-[18px] font-bold leading-none">Quizzo<span style={{ color: 'var(--accent-deep)' }}>.</span></div>
              <div className="font-mono text-[9px] font-bold opacity-50 uppercase tracking-[0.2em] mt-0.5">CLUB · v1</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="btl btl-sm sh-2 px-2 py-1 flex items-center gap-1" style={{ background: '#fff' }}>
              <span className="text-sm leading-none">🔥</span>
              <span className="font-mono font-bold text-[12px] tabular">0</span>
            </div>
            <Link to="/profile"
              className="w-9 h-9 btl btl-sm sh-2 grid place-items-center font-bold text-[16px]"
              style={{ background: 'var(--accent)' }}>
              {user.first_name?.[0]?.toUpperCase()}
            </Link>
          </div>
        </div>
      </header>

      {/* Marquee */}
      <div className="overflow-hidden border-y-[2.5px] border-[var(--line)] py-1.5 shrink-0"
        style={{ background: 'var(--ink)', color: '#fff' }}>
        <div className="anim-marquee flex whitespace-nowrap font-mono font-bold text-[11px] uppercase tracking-widest">
          {[0, 1].map(k => (
            <div key={k} className="flex shrink-0">
              {[
                `⚡ ${xp} XP UKUPNO`,
                `🏆 #${rank} LJESTVICA`,
                `⚔️ IZAZOVI ČEKAJU`,
                `📅 DNEVNI KVIZ ${dailyDone ? 'RIJEŠEN ✓' : 'SPREMAN'}`,
              ].map((m, i) => (
                <span key={i} className="px-6 inline-flex items-center gap-2">
                  {m} <span className="opacity-40">//</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar app-scroll-with-nav">
        {/* Greeting + XP */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-baseline justify-between mb-1">
            <h1 className="font-display text-[26px] leading-none tracking-tight">Hej, {user.first_name}!</h1>
          </div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-widest opacity-60">
            // {xp} XP UKUPNO
          </div>
          <div className="mt-2 btl-sm btl" style={{ background: '#fff', padding: 2, height: 12, borderRadius: 999 }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (xp % 500) / 5)}%`,
              borderRadius: 999,
              background: 'var(--accent)',
              border: '1.5px solid var(--line)',
              minWidth: xp > 0 ? 8 : 0,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>

        {/* Daily quiz hero */}
        <div className="px-4 pb-4">
          <button onClick={() => navigate('/daily')}
            className="btl btl-lg sh-6 w-full text-left p-5 relative overflow-hidden anim-pop"
            style={{ background: 'var(--accent)', color: 'var(--ink)' }}>
            <div className="absolute inset-0 grid-dots opacity-20" />
            <div className="relative">
              <div className="flex items-start justify-between mb-2">
                <span className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>⟶ DNEVNI KVIZ</span>
                <div className="font-mono text-[10px] font-bold opacity-70 tabular">Q#{String(day).padStart(3, '0')}</div>
              </div>
              <div className="font-display text-[36px] leading-[0.9] tracking-tight whitespace-pre-line mt-2">
                Dokaži svoje{'\n'}opće znanje
              </div>
              <div className="flex items-center gap-3 mt-4">
                <div className="btn btn-primary btn-sm" style={{ background: 'var(--ink)', color: '#fff', boxShadow: '3px 3px 0 0 var(--line)' }}>
                  {dailyDone ? '✓ Riješeno' : '▶ Spreman'}
                </div>
                <div className="font-mono text-[11px] font-bold">+200 XP · 10 Q</div>
              </div>
            </div>
          </button>
        </div>

        {/* Categories — row layout */}
        <div className="px-4 pb-3">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-mono text-[12px] font-bold uppercase tracking-widest">Odaberi kategoriju</h2>
            <span className="font-mono text-[10px] font-bold opacity-60">06 CAT.</span>
          </div>
          <div className="flex flex-col gap-2">
            {CATEGORIES.map((cat, i) => (
              <button key={cat.id} onClick={() => navigate(`/quiz/${cat.id}`)}
                className="btl sh-4 flex items-center gap-3 p-3 text-left anim-slideup hover:-translate-y-0.5 transition-transform"
                style={{ animationDelay: `${i * 0.04}s`, background: '#fff' }}>
                <span className="shrink-0 w-12 h-12 btl btl-sm grid place-items-center text-2xl"
                  style={{ background: `oklch(0.9 0.1 ${cat.hue})`, boxShadow: '2px 2px 0 0 var(--line)' }}>
                  {cat.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[17px] leading-tight truncate">{cat.name}</div>
                  <div className="font-mono text-[10px] font-bold opacity-60 tabular uppercase tracking-wider">
                    {String(questionCounts[cat.id] || cat.count).padStart(3, '0')} PITANJA
                  </div>
                </div>
                <div className="shrink-0 w-10 h-10 btl btl-sm grid place-items-center"
                  style={{ background: 'var(--ink)', color: '#fff', boxShadow: '2px 2px 0 0 var(--accent)' }}>
                  ▶
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="px-4 pb-5 grid grid-cols-2 gap-3">
          <Link to="/challenges" className="btl sh-4 p-3 text-left hover:-translate-y-0.5 transition-transform" style={{ background: '#fff' }}>
            <div className="w-10 h-10 btl btl-sm grid place-items-center mb-2 text-xl"
              style={{ background: 'var(--accent)', boxShadow: '2px 2px 0 0 var(--line)' }}>⚔️</div>
            <div className="font-display text-[14px] leading-tight">Izazovi</div>
            <div className="font-mono text-[10px] font-bold opacity-60 uppercase tracking-wider mt-0.5">Igraj protiv prijatelja</div>
          </Link>
          <Link to="/leaderboard" className="btl sh-4 p-3 text-left hover:-translate-y-0.5 transition-transform" style={{ background: '#fff' }}>
            <div className="w-10 h-10 btl btl-sm grid place-items-center mb-2 text-xl"
              style={{ background: 'var(--accent)', boxShadow: '2px 2px 0 0 var(--line)' }}>🏆</div>
            <div className="font-display text-[14px] leading-tight">Ljestvica</div>
            <div className="font-mono text-[10px] font-bold opacity-60 uppercase tracking-wider mt-0.5">Vidi tko je prvi</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
