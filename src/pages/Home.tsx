import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'

const categoryColors: Record<string, string> = {
  geography:   'from-blue-500 to-blue-700',
  history:     'from-amber-500 to-amber-700',
  sports:      'from-green-500 to-green-700',
  science:     'from-purple-500 to-purple-700',
  film_music:  'from-pink-500 to-pink-700',
  pop_culture: 'from-orange-500 to-orange-700',
}

const categoryBg: Record<string, string> = {
  geography:   'bg-blue-500/10 hover:bg-blue-500/20',
  history:     'bg-amber-500/10 hover:bg-amber-500/20',
  sports:      'bg-green-500/10 hover:bg-green-500/20',
  science:     'bg-purple-500/10 hover:bg-purple-500/20',
  film_music:  'bg-pink-500/10 hover:bg-pink-500/20',
  pop_culture: 'bg-orange-500/10 hover:bg-orange-500/20',
}

export default function Home() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [dailyDone, setDailyDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.auth.getUser(),
      api.quiz.categories(),
    ]).then(([u, cats]) => {
      setUser(u)
      setCategories(cats.categories)
      if (u) {
        // Load user stats + daily status
        api.quiz.daily().then(d => setDailyDone(d.already_completed)).catch(() => {})
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function startQuiz(categoryId: string) {
    navigate(`/quiz/${categoryId}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-gray-950/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <span className="font-black text-white text-xl tracking-tight">Quizzo Club</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/leaderboard"
                  className="text-white/60 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  🏆 Top lista
                </Link>
                <Link
                  to="/challenges"
                  className="text-white/60 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  ⚔️ Izazovi
                </Link>
                <button
                  onClick={() => { api.auth.logout(); window.location.reload() }}
                  className="text-white/40 hover:text-white/70 text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {user.first_name}
                </button>
              </>
            ) : (
              <>
                <Link to="/signin" className="text-white/60 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  Prijava
                </Link>
                <Link to="/signup" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-1.5 rounded-xl transition-colors">
                  Registracija
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <section className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-3 leading-tight">
            Dokaži svoje<br className="sm:hidden" /> opće znanje
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto">
            Kviz pitanja iz geografije, sporta, povijesti, znanosti, filma i pop kulture.
          </p>
        </section>

        {/* Daily quiz banner */}
        <section
          onClick={() => navigate('/daily')}
          className={`mb-8 rounded-3xl p-5 sm:p-6 cursor-pointer transition-all border ${
            dailyDone
              ? 'bg-green-900/30 border-green-500/30 opacity-75'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 border-transparent hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-900/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">📅</span>
                <span className="text-white font-bold text-lg">Dnevni kviz</span>
                {dailyDone && (
                  <span className="text-green-300 bg-green-900/50 text-xs px-2 py-0.5 rounded-full font-semibold">✓ Riješen</span>
                )}
              </div>
              <p className="text-white/70 text-sm">
                {dailyDone ? 'Već si riješio/la dnevni kviz. Vidi rezultate!' : '10 pitanja · Miješane kategorije · Jednom dnevno'}
              </p>
            </div>
            <div className={`text-3xl transition-transform ${dailyDone ? '' : 'group-hover:scale-110'}`}>
              {dailyDone ? '✅' : '▶️'}
            </div>
          </div>
        </section>

        {/* Categories */}
        <section>
          <h2 className="text-white font-bold text-xl mb-4">Odaberi kategoriju</h2>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => startQuiz(cat.id)}
                  className={`relative flex flex-col items-center justify-center gap-2 p-4 sm:p-6 rounded-2xl border border-white/10 transition-all duration-200 hover:scale-[1.02] hover:border-white/20 active:scale-[0.98] ${categoryBg[cat.id] || 'bg-white/5 hover:bg-white/10'}`}
                >
                  <span className="text-4xl sm:text-5xl">{cat.emoji}</span>
                  <span className="text-white font-bold text-sm sm:text-base text-center leading-tight">{cat.name}</span>
                  <span className="text-white/40 text-xs">{cat.question_count || 60}+ pitanja</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/leaderboard"
            className="flex items-center gap-4 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors"
          >
            <span className="text-3xl">🏆</span>
            <div>
              <div className="text-white font-semibold">Top lista</div>
              <div className="text-white/50 text-sm">Vidi tko je najbolji</div>
            </div>
            <span className="ml-auto text-white/30">→</span>
          </Link>
          <Link
            to="/challenges"
            className="flex items-center gap-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            <span className="text-3xl">⚔️</span>
            <div>
              <div className="text-white font-semibold">Izazovi i Hunter Mode</div>
              <div className="text-white/50 text-sm">Izazovi prijatelje</div>
            </div>
            <span className="ml-auto text-white/30">→</span>
          </Link>
        </section>

        {/* Subscribe CTA */}
        {!user && (
          <section className="mt-8 rounded-3xl bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 p-6 text-center">
            <p className="text-white font-bold text-lg mb-1">Registriraj se besplatno</p>
            <p className="text-white/60 text-sm mb-4">Prati svoje rezultate, ulazi na top listu i izazivaj prijatelje.</p>
            <Link
              to="/signup"
              className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
            >
              Stvori račun
            </Link>
          </section>
        )}
      </main>

      <footer className="border-t border-white/10 py-6 px-4 text-center mt-8">
        <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} Quizzo Club</span>
          <span>·</span>
          <Link to="/subscribe" className="hover:text-gray-400">Pro pretplata</Link>
        </div>
      </footer>
    </div>
  )
}
