import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function DailyQuiz() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [completion, setCompletion] = useState<any>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    api.quiz.daily()
      .then(data => {
        setAlreadyDone(data.already_completed)
        setCompletion(data.completion)
        setLoading(false)
        if (!data.already_completed) {
          // Start immediately
          setStarting(true)
          api.auth.getUser().then(user => {
            if (!user) {
              // Start as guest daily — create a daily-type session
              navigate('/quiz/daily-play', {
                state: { session: { session_id: null, questions: data.questions }, isDaily: true }
              })
            } else {
              // Create session and navigate
              navigate('/quiz/daily-play', {
                state: { session: { session_id: null, questions: data.questions }, isDaily: true }
              })
            }
          })
        }
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading || starting) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">📅</div>
          <p className="text-white/60">Učitavam dnevni kviz…</p>
        </div>
      </div>
    )
  }

  // Already completed — show results summary
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-white font-black text-2xl mb-2">Dnevni kviz riješen!</h1>
        <p className="text-white/60 mb-6">Vrati se sutra za nova pitanja.</p>
        {completion && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/5 rounded-2xl p-4">
              <div className="text-green-400 font-black text-2xl">{completion.correct_count}/10</div>
              <div className="text-white/40 text-sm">točnih</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-4">
              <div className="text-indigo-300 font-black text-2xl">{completion.score}</div>
              <div className="text-white/40 text-sm">bodova</div>
            </div>
          </div>
        )}
        <div className="space-y-3">
          <button onClick={() => navigate('/leaderboard?type=daily')} className="w-full py-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 font-semibold">
            🏆 Dnevna top lista
          </button>
          <button onClick={() => navigate('/')} className="w-full py-3 rounded-2xl bg-white/10 text-white font-semibold">
            Nazad na početnu
          </button>
        </div>
      </div>
    </div>
  )
}
