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
  answers: { correct: boolean; points: number; selectedIndex: number; correctIndex: number }[]
  score: number
  startedAt: number
}

const QUESTION_TIME = 20 // seconds

export default function QuizPlay() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Support external session injection (challenges/daily)
  const externalSession = (location.state as any)?.session as {
    session_id: string
    questions: Question[]
    challenge_id?: string
    mode?: string
  } | null

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

  // Start quiz
  useEffect(() => {
    if (externalSession) {
      setQuiz({
        sessionId: externalSession.session_id,
        questions: externalSession.questions,
        currentIndex: 0,
        answers: [],
        score: 0,
        startedAt: Date.now(),
      })
      setLoading(false)
      return
    }

    if (!categoryId) return
    api.quiz.start(categoryId)
      .then(data => {
        setQuiz({
          sessionId: data.session_id,
          questions: data.questions,
          currentIndex: 0,
          answers: [],
          score: 0,
          startedAt: Date.now(),
        })
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Greška pri učitavanju')
        setLoading(false)
      })
  }, [categoryId])

  // Timer
  useEffect(() => {
    if (!quiz || revealed || finished) return
    setTimeLeft(QUESTION_TIME)
    questionStartRef.current = Date.now()

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          handleAnswer(-1) // time out = wrong
          return 0
        }
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
      const newAnswers = [...quiz.answers, {
        correct: result.correct,
        points: result.points,
        selectedIndex,
        correctIndex: result.correct_index,
      }]

      setQuiz(prev => prev ? { ...prev, answers: newAnswers, score: prev.score + result.points } : prev)

      setTimeout(() => {
        if (quiz.currentIndex + 1 >= quiz.questions.length) {
          finishQuiz(quiz.sessionId, newAnswers)
        } else {
          setQuiz(prev => prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : prev)
          setSelected(null)
          setRevealed(false)
          setSubmitting(false)
        }
      }, 1500)
    } catch {
      setSubmitting(false)
    }
  }, [quiz, revealed, submitting])

  async function finishQuiz(sessionId: string, answers: any[]) {
    setFinished(true)
    try {
      const result = await api.quiz.finish(sessionId)
      const state = (location.state as any)
      navigate('/results', {
        state: {
          session: result.session,
          xp_earned: result.xp_earned,
          percentage: result.percentage,
          challenge_id: state?.session?.challenge_id,
          answers,
        },
        replace: true,
      })
    } catch {
      navigate('/', { replace: true })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🧠</div>
          <p className="text-white/60">Učitavam pitanja…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">😵</div>
          <p className="text-white mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="bg-indigo-600 text-white px-6 py-2 rounded-xl">
            Nazad
          </button>
        </div>
      </div>
    )
  }

  if (!quiz) return null

  const q = quiz.questions[quiz.currentIndex]
  const progress = ((quiz.currentIndex) / quiz.questions.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-white/40 hover:text-white/70 transition-colors text-sm">
            ✕
          </button>
          {/* Progress bar */}
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Timer */}
          <div className={`font-bold text-sm tabular-nums w-8 text-right transition-colors ${
            timeLeft <= 5 ? 'text-red-400' : 'text-white/70'
          }`}>
            {timeLeft}s
          </div>
          {/* Score */}
          <div className="text-indigo-300 font-bold text-sm tabular-nums">
            {quiz.score} pt
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          {/* Question counter */}
          <div className="text-white/40 text-sm text-center mb-4">
            Pitanje {quiz.currentIndex + 1} / {quiz.questions.length}
          </div>

          {/* Question text */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 mb-6">
            <p className="text-white font-semibold text-lg sm:text-xl text-center leading-snug">
              {q.question}
            </p>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {q.options.map((opt, i) => {
              let btnClass = 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'

              if (revealed) {
                if (opt.correct) {
                  btnClass = 'bg-green-500/20 border-green-500/50 text-green-300'
                } else if (selected === i && !opt.correct) {
                  btnClass = 'bg-red-500/20 border-red-500/50 text-red-300'
                } else {
                  btnClass = 'bg-white/3 border-white/5 text-white/30'
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={revealed}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200 text-left disabled:cursor-default ${btnClass}`}
                >
                  <span className="shrink-0 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">
                    {['A','B','C','D'][i]}
                  </span>
                  <span className="text-sm sm:text-base font-medium leading-snug">{opt.text}</span>
                  {revealed && opt.correct && <span className="ml-auto">✓</span>}
                  {revealed && selected === i && !opt.correct && <span className="ml-auto">✗</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
