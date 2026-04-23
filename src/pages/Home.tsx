import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'

const CATEGORIES = [
  { id: 'geography',   emoji: '🌍', name: 'Geografija',       hue: 220, count: 72 },
  { id: 'history',     emoji: '📚', name: 'Povijest',         hue: 35,  count: 68 },
  { id: 'sports',      emoji: '⚽', name: 'Sport',            hue: 150, count: 64 },
  { id: 'science',     emoji: '🔬', name: 'Priroda i Znan.',  hue: 280, count: 70 },
  { id: 'film_music',  emoji: '🎬', name: 'Film i Glazba',    hue: 345, count: 66 },
  { id: 'pop_culture', emoji: '🎭', name: 'Pop Kultura',      hue: 25,  count: 60 },
]

export default function Home() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [dailyDone, setDailyDone] = useState(false)
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    api.auth.getUser().then(u => {
      setUser(u)
      if (u) api.quiz.daily().then(d => setDailyDone(d.already_completed)).catch(() => {})
    })
    api.quiz.categories().then(r => {
      const counts: Record<string, number> = {}
      r.categories.forEach((c: any) => { counts[c.id] = c.question_count || 60 })
      setQuestionCounts(counts)
    }).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      {/* Header */}
      <header className="px-4 pt-4 pb-3 border-b-[2.5px]" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/quizzo-icon.jpg" alt="Quizzo" className="h-9 w-9 rounded-lg btl btl-sm sh-2" style={{ objectFit: 'cover' }} />
            <div className="leading-tight">
              <div className="font-display text-lg leading-none">Quizzo<span style={{ color: 'var(--accent-deep)' }}>.</span></div>
              <div className="font-mono text-[9px] font-bold opacity-50 uppercase tracking-[0.2em] mt-0.5">CLUB</div>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/leaderboard" className="btl btl-sm sh-2 px-3 py-1.5 text-xs font-bold font-mono uppercase tracking-wider hover:-translate-y-0.5 transition-transform" style={{ background: '#fff' }}>
              🏆 Lista
            </Link>
            <Link to="/challenges" className="btl btl-sm sh-2 px-3 py-1.5 text-xs font-bold font-mono uppercase tracking-wider hover:-translate-y-0.5 transition-transform" style={{ background: '#fff' }}>
              ⚔️ Vs
            </Link>
            {user ? (
              <button
                onClick={() => { api.auth.logout(); window.location.reload() }}
                className="btl btl-sm sh-2 px-3 py-1.5 flex items-center gap-2 text-sm font-bold font-display hover:-translate-y-0.5 transition-transform"
                style={{ background: '#fff' }}
              >
                <span className="w-6 h-6 rounded-full grid place-items-center text-xs font-bold btl btl-sm" style={{ background: 'var(--accent)' }}>
                  {user.first_name?.[0]?.toUpperCase()}
                </span>
                {user.first_name}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/signin" className="btn btn-sm">Prijava</Link>
                <Link to="/signup" className="btn btn-primary btn-sm">Registracija</Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Hero */}
        <section className="mb-6">
          <button
            onClick={() => navigate('/daily')}
            className="btl btl-lg sh-6 w-full text-left p-5 relative overflow-hidden anim-pop"
            style={{ background: 'var(--accent)' }}
          >
            <div className="absolute inset-0 grid-dots opacity-20" />
            <div className="relative">
              <div className="flex items-start justify-between mb-2">
                <span className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>⟶ DNEVNI</span>
                <div className="font-mono text-[10px] font-bold opacity-70 tabular">Q#{String(new Date().getDate()).padStart(3, '0')}</div>
              </div>
              <div className="font-display text-[36px] sm:text-[40px] leading-[0.9] tracking-tight whitespace-pre-line mt-2">
                Dokaži svoje{'\n'}opće znanje
              </div>
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <div className="btn btn-primary btn-sm" style={{ background: 'var(--ink)', color: '#fff', boxShadow: '3px 3px 0 0 var(--line)' }}>
                  {dailyDone ? '✓ Riješeno' : '▶ Spreman'}
                </div>
                <div className="font-mono text-[11px] font-bold">+200 XP · 10 Q</div>
              </div>
            </div>
          </button>
        </section>

        {/* Categories */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-[12px] font-bold uppercase tracking-widest">Odaberi kategoriju</h2>
            <span className="font-mono text-[10px] font-bold opacity-60">06 CAT.</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/quiz/${cat.id}`)}
                className="btl sh-4 flex items-center gap-3 p-3 text-left anim-slideup hover:-translate-y-0.5 transition-transform"
                style={{
                  animationDelay: `${i * 0.04}s`,
                  background: '#fff'
                }}
              >
                <span
                  className="shrink-0 w-12 h-12 btl btl-sm grid place-items-center text-2xl"
                  style={{
                    background: `oklch(0.9 0.1 ${cat.hue})`,
                    boxShadow: '2px 2px 0 0 var(--line)'
                  }}
                >
                  {cat.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[17px] leading-tight truncate">{cat.name}</div>
                  <div className="font-mono text-[10px] font-bold opacity-60 tabular uppercase tracking-wider">
                    {String(questionCounts[cat.id] || cat.count).padStart(3, '0')} PITANJA
                  </div>
                </div>
                <div className="shrink-0 w-10 h-10 btl btl-sm grid place-items-center" style={{ background: 'var(--ink)', color: '#fff', boxShadow: '2px 2px 0 0 var(--accent)' }}>
                  ▶
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Quick links */}
        <section className="grid sm:grid-cols-2 gap-3 mb-6">
          <Link
            to="/challenges"
            className="btl sh-4 p-3 text-left hover:-translate-y-0.5 transition-transform"
            style={{ background: '#fff' }}
          >
            <div className="w-10 h-10 btl btl-sm grid place-items-center mb-2 text-xl" style={{ background: 'var(--accent)', boxShadow: '2px 2px 0 0 var(--line)' }}>
              ⚔️
            </div>
            <div className="font-display text-[14px] leading-tight">Izazovi</div>
            <div className="font-mono text-[10px] font-bold opacity-60 uppercase tracking-wider mt-0.5">Igraj protiv prijatelja</div>
          </Link>
          <Link
            to="/leaderboard"
            className="btl sh-4 p-3 text-left hover:-translate-y-0.5 transition-transform"
            style={{ background: '#fff' }}
          >
            <div className="w-10 h-10 btl btl-sm grid place-items-center mb-2 text-xl" style={{ background: 'var(--accent)', boxShadow: '2px 2px 0 0 var(--line)' }}>
              🏆
            </div>
            <div className="font-display text-[14px] leading-tight">Ljestvica</div>
            <div className="font-mono text-[10px] font-bold opacity-60 uppercase tracking-wider mt-0.5">Vidi tko je prvi</div>
          </Link>
        </section>

        {/* Sign up CTA */}
        {!user && (
          <section className="btl sh-ink-acc p-6 text-center anim-slideup" style={{ background: 'var(--ink)', color: '#fff' }}>
            <p className="font-display text-[22px] leading-tight mb-1">Priključi se besplatno</p>
            <p className="font-mono text-[11px] opacity-70 mb-4">Prati rezultate, penjuj se na ljestvicu i izazivaj prijatelje</p>
            <Link to="/signup" className="btn" style={{ background: '#fff', color: 'var(--ink)' }}>
              Stvori račun →
            </Link>
          </section>
        )}
      </main>

      <footer className="border-t-[2.5px] py-5 px-4 text-center mt-6" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-center gap-4 font-mono text-[10px] opacity-40 uppercase tracking-widest">
          <span>© {new Date().getFullYear()} Quizzo Club</span>
          <span>·</span>
          <Link to="/subscribe" className="hover:opacity-70">Pro</Link>
        </div>
      </footer>
    </div>
  )
}
