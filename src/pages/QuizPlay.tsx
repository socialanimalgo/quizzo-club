import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { api } from '../lib/api'

interface Question {
  id: string
  question: string
  options: { text: string; correct: boolean }[]
}

interface QuizState {
  sessionId: string
  questions: Question[]
  currentIndex: number
  answers: { correct: boolean; points: number; selectedIndex: number; correctIndex: number; question: string }[]
  score: number
  startedAt: number
}

const QUESTION_TIME = 20

const OPTION_LETTERS = ['A', 'B', 'C', 'D']
const OPTION_COLORS = [
  { base: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100', correct: 'bg-green-100 border-green-400 text-green-800', wrong: 'bg-red-50 border-red-200 text-red-400', dim: 'bg-gray-50 border-gray-100 text-gray-300' },
  { base: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100', correct: 'bg-green-100 border-green-400 text-green-800', wrong: 'bg-red-50 border-red-200 text-red-400', dim: 'bg-gray-50 border-gray-100 text-gray-300' },
  { base: 'bg-violet-50 border-violet-200 text-violet-800 hover:bg-violet-100', correct: 'bg-green-100 border-green-400 text-green-800', wrong: 'bg-red-50 border-red-200 text-red-400', dim: 'bg-gray-50 border-gray-100 text-gray-300' },
  { base: 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100', correct: 'bg-green-100 border-green-400 text-green-800', wrong: 'bg-red-50 border-red-200 text-red-400', dim: 'bg-gray-50 border-gray-100 text-gray-300' },
]

export default function QuizPlay() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const externalSession = (location.state as any)?.session

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quiz, setQuiz] = useState<QuizState | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME)
  const [submitting, setSubmitting] = useState(false)
  const [finished, setFinished] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const questionStartRef = useRef(Date.now())

  useEffect(() => {
    if (externalSession) {
      setQuiz({ sessionId: externalSession.session_id, questions: externalSession.questions, currentIndex: 0, answers: [], score: 0, startedAt: Date.now() })
      setLoading(false)
      return
    }
    if (!categoryId) return
    api.quiz.start(categoryId)
      .then(data => {
        setQuiz({ sessionId: data.session_id, questions: data.questions, currentIndex: 0, answers: [], score: 0, startedAt: Date.now() })
        setLoading(false)
      })
      .catch(err => { setError(err.message || 'Greška'); setLoading(false) })
  }, [categoryId])

  useEffect(() => {
    if (!quiz || revealed || finished) return
    setTimeLeft(QUESTION_TIME)
    questionStartRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); handleAnswer(-1); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [quiz?.currentIndex])

  const handleAnswer = useCallback(async (selectedIndex: number) => {
    if (!quiz || revealed || submitting) return
    clearInterval(timerRef.current!)
    setSelected(selectedIndex)
    setRevealed(true)
    setSubmitting(true)
    const elapsed = Date.now() - questionStartRef.current
    const q = quiz.questions[quiz.currentIndex]
    try {
      const result = await api.quiz.answer(quiz.sessionId, q.id, selectedIndex, elapsed)
      const newAnswers = [...quiz.answers, { correct: result.correct, points: result.points, selectedIndex, correctIndex: result.correct_index, question: q.question }]
      setQuiz(prev => prev ? { ...prev, answers: newAnswers, score: prev.score + result.points } : prev)
      setTimeout(() => {
        if (quiz.currentIndex + 1 >= quiz.questions.length) {
          finishQuiz(quiz.sessionId, newAnswers)
        } else {
          setQuiz(prev => prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : prev)
          setSelected(null); setRevealed(false); setSubmitting(false)
        }
      }, 1600)
    } catch { setSubmitting(false) }
  }, [quiz, revealed, submitting])

  async function finishQuiz(sessionId: string, answers: any[]) {
    setFinished(true)
    try {
      const result = await api.quiz.finish(sessionId)
      const state = (location.state as any)
      navigate('/results', { state: { session: result.session, xp_earned: result.xp_earned, percentage: result.percentage, challenge_id: state?.session?.challenge_id, answers }, replace: true })
    } catch { navigate('/', { replace: true }) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
      <div className="text-center"><div className="text-5xl mb-3 anim-bob">🧠</div><p className="font-mono text-sm opacity-60">Učitavam pitanja…</p></div>
    </div>
  )
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--paper)' }}>
      <div className="text-center"><p className="font-display text-lg mb-4">{error}</p><button onClick={() => navigate('/')} className="btn btn-primary">Nazad</button></div>
    </div>
  )
  if (!quiz) return null

  const q = quiz.questions[quiz.currentIndex]
  const progress = (quiz.currentIndex / quiz.questions.length) * 100
  const timerPct = (timeLeft / QUESTION_TIME) * 100

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)' }}>
      {/* Top bar */}
      <div className="px-4 pt-4 pb-3 shrink-0 border-b-[2.5px] sticky top-0 z-10" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="btl btl-sm sh-2 w-9 h-9 grid place-items-center" style={{ background: '#fff' }}>✕</button>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest opacity-60">Kviz</span>
                <span className="font-mono text-[11px] font-bold tabular">{String(quiz.currentIndex + 1).padStart(2, '0')}/{String(quiz.questions.length).padStart(2, '0')}</span>
              </div>
              <div className="h-2 btl btl-sm overflow-hidden" style={{ background: '#fff', padding: 1, borderRadius: 4 }}>
                <div className="h-full anim-fill transition-all duration-500" style={{ width: `${progress}%`, background: 'var(--ink)', borderRadius: 2 }} />
              </div>
            </div>
            <div className="btl btl-sm sh-2 px-2.5 py-1.5" style={{ background: 'var(--accent)' }}>
              <div className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-70">SCORE</div>
              <div className="font-display text-[18px] leading-none tabular">{quiz.score}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 btl btl-sm overflow-hidden" style={{ background: '#fff', padding: 1, borderRadius: 4 }}>
              <div
                className="h-full transition-all duration-1000"
                style={{
                  width: `${timerPct}%`,
                  background: timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f59e0b' : '#22c55e',
                  borderRadius: 2
                }}
              />
            </div>
            <span className={`font-mono text-[13px] font-bold tabular w-8 text-right ${timeLeft <= 5 ? 'animate-pulse' : ''}`} style={{ color: timeLeft <= 5 ? '#ef4444' : 'inherit' }}>
              {String(timeLeft).padStart(2, '0')}s
            </span>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4">
        <div className="w-full max-w-xl mx-auto">
          <div className="btl btl-lg sh-6 p-5 mb-4 anim-pop" style={{ background: '#fff' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>?</span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">Pitanje {quiz.currentIndex + 1}</span>
            </div>
            <div className="font-display text-[22px] leading-tight tracking-tight">{q.question}</div>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {q.options.map((opt, i) => {
              let bg = '#fff'
              let shadow = '4px 4px 0 0 var(--line)'
              let dim = false
              if (revealed) {
                if (opt.correct) { bg = '#bbf7d0'; shadow = '4px 4px 0 0 #16a34a' }
                else if (selected === i) { bg = '#fecaca'; shadow = '4px 4px 0 0 #dc2626' }
                else dim = true
              }
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={revealed}
                  className="btl p-3.5 flex items-center gap-3 text-left anim-slideup transition-transform disabled:cursor-default"
                  style={{
                    background: bg,
                    boxShadow: shadow,
                    opacity: dim ? 0.4 : 1,
                    animationDelay: `${i * 0.04}s`,
                    transform: revealed && opt.correct ? 'translate(-1px,-1px)' : 'none'
                  }}
                >
                  <span
                    className="shrink-0 w-10 h-10 btl btl-sm grid place-items-center font-display text-[16px]"
                    style={{
                      background: revealed && opt.correct ? '#16a34a' : revealed && selected === i ? '#dc2626' : 'var(--ink)',
                      color: '#fff',
                      boxShadow: '2px 2px 0 0 var(--line)'
                    }}
                  >
                    {revealed && opt.correct ? '✓' : revealed && selected === i ? '✗' : OPTION_LETTERS[i]}
                  </span>
                  <span className="font-display text-[15px] leading-tight flex-1">{opt.text}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  var timerLeft = timeLeft
}
