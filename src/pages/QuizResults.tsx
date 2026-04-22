import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

function ScoreCircle({ pct }: { pct: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <svg width="128" height="128" className="rotate-[-90deg]">
      <circle cx="64" cy="64" r={r} fill="none" stroke="#ffffff15" strokeWidth="10" />
      <circle
        cx="64" cy="64" r={r} fill="none"
        stroke={pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'}
        strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
    </svg>
  )
}

export default function QuizResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as any

  const [challengeResult, setChallengeResult] = useState<any>(null)

  useEffect(() => {
    if (!state) {
      navigate('/')
      return
    }
    if (state.challenge_id) {
      api.challenges.complete(state.challenge_id)
        .then(r => setChallengeResult(r))
        .catch(() => {})
    }
  }, [])

  if (!state) return null

  const { session, xp_earned, percentage, answers } = state
  const correct = session?.correct_count ?? 0
  const total = session?.total_questions ?? 10
  const score = session?.score ?? 0

  const emoji = percentage >= 80 ? '🏆' : percentage >= 60 ? '🎉' : percentage >= 40 ? '👍' : '💪'
  const msg = percentage >= 80 ? 'Sjajno! Majstor si kviza!' :
    percentage >= 60 ? 'Dobro odrađeno!' :
    percentage >= 40 ? 'Dobra baza, ima prostora za napredak!' : 'Vježbaj — bit ćeš bolji!'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header card */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-4 text-center">
          <div className="text-6xl mb-2">{emoji}</div>
          <h1 className="text-white font-black text-2xl sm:text-3xl mb-1">{msg}</h1>

          {/* Score circle */}
          <div className="relative inline-block my-4">
            <ScoreCircle pct={percentage} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white font-black text-2xl">{percentage}%</span>
              <span className="text-white/40 text-xs">{correct}/{total}</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="bg-white/5 rounded-2xl p-3">
              <div className="text-indigo-300 font-black text-xl">{score}</div>
              <div className="text-white/40 text-xs">bodova</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-3">
              <div className="text-green-400 font-black text-xl">+{xp_earned}</div>
              <div className="text-white/40 text-xs">XP zarađeno</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-3">
              <div className="text-yellow-400 font-black text-xl">{correct}</div>
              <div className="text-white/40 text-xs">točnih</div>
            </div>
          </div>
        </div>

        {/* Challenge result */}
        {challengeResult?.status === 'waiting' && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-4 text-center">
            <p className="text-blue-300 font-semibold">⏳ Čekamo protivnika da završi izazov…</p>
            <p className="text-white/50 text-sm mt-1">Podijelio/la si link? Protivnik treba riješiti kviz.</p>
          </div>
        )}
        {challengeResult?.status === 'completed' && (
          <div className={`${challengeResult.winner_id ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'} border rounded-2xl p-4 mb-4 text-center`}>
            <p className="text-white font-bold text-lg">
              {challengeResult.winner_id ? '🏆 Rezultat izazova' : '🤝 Izjednačeno!'}
            </p>
            <div className="flex justify-center gap-6 mt-2 text-sm text-white/70">
              <span>Ti: {challengeResult.challenger_correct ?? '?'} točnih</span>
              <span>Protivnik: {challengeResult.challenged_correct ?? '?'} točnih</span>
            </div>
          </div>
        )}

        {/* Answer breakdown */}
        {answers?.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-4">
            <h2 className="text-white font-bold mb-3">Pregled odgovora</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {answers.map((a: any, i: number) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${a.correct ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  <span className={`text-lg ${a.correct ? 'text-green-400' : 'text-red-400'}`}>
                    {a.correct ? '✓' : '✗'}
                  </span>
                  <span className="text-white/70 text-sm flex-1 line-clamp-2">{a.question}</span>
                  <span className={`text-xs font-bold ${a.correct ? 'text-green-400' : 'text-red-400'}`}>
                    +{a.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate(-2)}
            className="py-3 rounded-2xl bg-white/10 text-white font-semibold hover:bg-white/15 transition-colors"
          >
            Igraj opet
          </button>
          <Link
            to="/"
            className="py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors text-center"
          >
            Početna
          </Link>
        </div>
        <div className="mt-3">
          <Link
            to="/leaderboard"
            className="block w-full py-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 font-semibold hover:bg-yellow-500/20 transition-colors text-center"
          >
            🏆 Pogledaj top listu
          </Link>
        </div>
      </div>
    </div>
  )
}
