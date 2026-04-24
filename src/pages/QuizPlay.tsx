import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import Icon from '../components/Icon'
import PowerupFab from '../components/PowerupFab'
import { useWallet } from '../context/WalletContext'
import { useLoadingOverlay } from '../context/LoadingOverlayContext'

interface Question {
  id: string
  question: string
  options: { text: string; correct: boolean }[]
}

interface AnswerResult {
  correct: boolean
  points: number
  selectedIndex: number
  correctIndex: number
  question: string
}

interface QuizState {
  sessionId: string
  questions: Question[]
  currentIndex: number
  answers: AnswerResult[]
  score: number
}

const QUESTION_TIME = 20
const OPTION_LETTERS = ['A', 'B', 'C', 'D']
const CATEGORY_LABELS: Record<string, string> = {
  geography: 'GEOGRAFIJA',
  history: 'POVIJEST',
  sports: 'SPORT',
  science: 'PRIRODA I ZNAN.',
  film_music: 'FILM I GLAZBA',
  pop_culture: 'POP KULTURA',
  daily: 'DNEVNI KVIZ',
}

function normalizeQuestions(input: any[] | undefined): Question[] {
  if (!Array.isArray(input)) return []

  return input
    .filter(Boolean)
    .map((question: any) => {
      const options = Array.isArray(question?.options)
        ? question.options
            .map((option: any) => {
              if (typeof option === 'string') return { text: option, correct: false }
              if (option && typeof option.text === 'string') return { text: option.text, correct: Boolean(option.correct) }
              return null
            })
            .filter(Boolean)
        : []

      if (!question?.id || typeof question.question !== 'string' || options.length < 2) return null
      return {
        id: question.id,
        question: question.question,
        options: options as { text: string; correct: boolean }[],
      }
    })
    .filter(Boolean) as Question[]
}

export default function QuizPlay() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = (location.state as any) || {}
  const externalSession = routeState.session

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quiz, setQuiz] = useState<QuizState | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME)
  const [submitting, setSubmitting] = useState(false)
  const [finished, setFinished] = useState(false)
  const [scorePulse, setScorePulse] = useState(0)
  const [questionShake, setQuestionShake] = useState(0)
  const [eliminated, setEliminated] = useState<number[]>([])
  const [powerupFlash, setPowerupFlash] = useState('')
  const [doubleXpActive, setDoubleXpActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const questionStartRef = useRef(Date.now())
  const { wallet, setWallet } = useWallet()

  const headerLabel = useMemo(() => {
    return routeState.categoryLabel || CATEGORY_LABELS[routeState?.session?.category_id] || CATEGORY_LABELS[categoryId || ''] || 'KVIZ'
  }, [routeState.categoryLabel, routeState?.session?.category_id, categoryId])

  useEffect(() => {
    if (externalSession) {
      const normalized = normalizeQuestions(externalSession.questions)
      if (!externalSession.session_id || normalized.length === 0) {
        setError('Sesija dnevnog kviza nije ispravna')
        setLoading(false)
        return
      }
      setQuiz({
        sessionId: externalSession.session_id,
        questions: normalized,
        currentIndex: 0,
        answers: [],
        score: 0,
      })
      setLoading(false)
      return
    }

    if (!categoryId) return

    api.quiz.start(categoryId)
      .then(data => {
        const normalized = normalizeQuestions(data.questions)
        if (normalized.length === 0) {
          throw new Error('Nema pitanja u ovoj sesiji')
        }
        setQuiz({
          sessionId: data.session_id,
          questions: normalized,
          currentIndex: 0,
          answers: [],
          score: 0,
        })
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Greška pri učitavanju kviza')
        setLoading(false)
      })
  }, [categoryId, externalSession])

  useEffect(() => {
    if (!quiz || revealed || finished) return
    setTimeLeft(QUESTION_TIME)
    questionStartRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft(current => {
        if (current <= 1) {
          clearInterval(timerRef.current!)
          handleAnswer(-1)
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [quiz?.currentIndex, revealed, finished])

  const finishQuiz = useCallback(async (sessionId: string, answers: AnswerResult[]) => {
    setFinished(true)
    try {
      const result = await api.quiz.finish(sessionId)
      navigate('/results', {
        replace: true,
        state: {
          session: result.session,
          xp_earned: result.xp_earned,
          percentage: result.percentage,
          challenge_id: routeState?.session?.challenge_id,
          hotTopic: routeState?.hotTopic ?? null,
          answers,
          categoryLabel: headerLabel,
          isDaily: Boolean(routeState?.isDaily),
          returnTo: routeState?.returnTo || (categoryId ? `/quiz/${categoryId}` : '/'),
        },
      })
    } catch {
      navigate('/', { replace: true })
    }
  }, [navigate, routeState, categoryId, headerLabel])

  const handleAnswer = useCallback(async (selectedIndex: number, powerupId?: string | null) => {
    if (!quiz || revealed || submitting) return

    clearInterval(timerRef.current!)
    setSelected(selectedIndex)
    setRevealed(true)
    setSubmitting(true)

    const elapsed = Date.now() - questionStartRef.current
    const currentQuestion = quiz.questions[quiz.currentIndex]

    try {
      const result = await api.quiz.answer(quiz.sessionId, currentQuestion.id, selectedIndex, elapsed, powerupId)
      if (result.wallet) setWallet(result.wallet)
      if (result.correct) setScorePulse(value => value + 1)
      else setQuestionShake(value => value + 1)
      if (powerupId === 'doublexp') setDoubleXpActive(false)

      const newAnswers = [
        ...quiz.answers,
        {
          correct: result.correct,
          points: result.points,
          selectedIndex,
          correctIndex: result.correct_index,
          question: currentQuestion.question,
        },
      ]

      setQuiz(prev => prev ? {
        ...prev,
        answers: newAnswers,
        score: prev.score + result.points,
      } : prev)

      window.setTimeout(() => {
        if (quiz.currentIndex + 1 >= quiz.questions.length) {
          finishQuiz(quiz.sessionId, newAnswers)
          return
        }

        setQuiz(prev => prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : prev)
        setSelected(null)
        setRevealed(false)
        setSubmitting(false)
        setEliminated([])
      }, 1500)
    } catch (err: any) {
      setSubmitting(false)
      setError(err.message || 'Greška pri slanju odgovora')
    }
  }, [finishQuiz, quiz, revealed, submitting, setWallet])

  useEffect(() => {
    return () => clearInterval(timerRef.current!)
  }, [])

  useLoadingOverlay(loading, { message: 'MJEŠAM PITANJA' })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-3 grid place-items-center btl anim-bob" style={{ background: 'var(--accent)' }}>
            <Icon name="play" className="w-6 h-6" stroke={2.2} />
          </div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest opacity-60">Učitavam pitanja</p>
        </div>
      </div>
    )
  }

  if (error && !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--paper)' }}>
        <div className="text-center">
          <p className="font-display text-lg mb-4">{error}</p>
          <button onClick={() => navigate(routeState?.returnTo || '/')} className="btn btn-primary">Nazad</button>
        </div>
      </div>
    )
  }

  if (!quiz) return null

  const question = quiz.questions[quiz.currentIndex]
  const sessionId = quiz.sessionId
  const progress = ((quiz.currentIndex + 1) / quiz.questions.length) * 100
  const timerPct = (timeLeft / QUESTION_TIME) * 100

  function usePowerup(powerupId: string) {
    if (revealed || submitting) return
    const qty = wallet.inv?.[powerupId] || 0
    if (qty < 1) return

    if (powerupId === 'fifty') {
      const wrongIndexes = question.options.map((option, index) => ({ option, index })).filter(item => !item.option.correct).map(item => item.index)
      const nextGone = wrongIndexes.sort(() => Math.random() - 0.5).slice(0, 2)
      setEliminated(nextGone)
      setPowerupFlash('50:50 — dva odgovora maknuta')
      window.setTimeout(() => setPowerupFlash(''), 1800)
      setWallet({ ...wallet, inv: { ...wallet.inv, fifty: Math.max(0, (wallet.inv?.fifty || 0) - 1) } })
      api.quiz.answer(sessionId, question.id, -1, 0, 'fifty').then(result => {
        if (result.wallet) setWallet(result.wallet)
      }).catch(() => {
        setWallet(wallet)
        setEliminated([])
        setError('50:50 nije uspio')
      })
      return
    }

    if (powerupId === 'doublexp') {
      setDoubleXpActive(true)
      setPowerupFlash('⚡ 2× XP aktivno')
      window.setTimeout(() => setPowerupFlash(''), 1800)
      setWallet({ ...wallet, inv: { ...wallet.inv, doublexp: Math.max(0, (wallet.inv?.doublexp || 0) - 1) } })
      api.quiz.answer(sessionId, question.id, -1, 0, 'doublexp').then(result => {
        if (result.wallet) setWallet(result.wallet)
      }).catch(() => {
        setWallet(wallet)
        setDoubleXpActive(false)
        setError('2× XP nije uspio')
      })
      return
    }

    const correctIndex = question.options.findIndex(option => option.correct)
    setPowerupFlash(powerupId === 'freeze' ? '❄️ Freeze — rješavam pitanje' : '🔍 Reveal — odgovor otkriven')
    window.setTimeout(() => setPowerupFlash(''), 1800)
    setWallet({ ...wallet, inv: { ...wallet.inv, [powerupId]: Math.max(0, (wallet.inv?.[powerupId] || 0) - 1) } })
    if (powerupId === 'freeze') clearInterval(timerRef.current!)
    window.setTimeout(() => handleAnswer(correctIndex, powerupId), powerupId === 'freeze' ? 500 : 400)
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <div className="px-4 pt-4 pb-3 shrink-0 border-b-[2.5px]" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(routeState?.returnTo || -1)} className="btl btl-sm sh-2 w-9 h-9 grid place-items-center" style={{ background: '#fff' }}>
              <Icon name="x" className="w-4 h-4" stroke={2.4} />
            </button>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em]">{headerLabel}</span>
                <span className="font-mono text-[11px] font-bold tabular">{String(quiz.currentIndex + 1).padStart(2, '0')}/{String(quiz.questions.length).padStart(2, '0')}</span>
              </div>
              <div className="h-[10px] btl btl-sm overflow-hidden" style={{ background: '#fff', padding: 2, borderRadius: 999 }}>
                <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: 'var(--ink)', borderRadius: 999 }} />
              </div>
            </div>
            <div key={scorePulse} className={`btl btl-sm sh-2 px-3 py-2 min-w-[92px] ${scorePulse ? 'anim-bump' : ''}`} style={{ background: 'var(--accent)' }}>
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] opacity-70">SCORE</div>
              <div className="font-display text-[24px] leading-none tabular">{quiz.score}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Icon name="clock" className="w-5 h-5 shrink-0" stroke={2.3} />
            <div className="flex-1 h-[10px] btl btl-sm overflow-hidden" style={{ background: '#fff', padding: 2, borderRadius: 999 }}>
              <div
                className="h-full transition-all duration-1000"
                style={{
                  width: `${timerPct}%`,
                  background: timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f59e0b' : '#22c55e',
                  borderRadius: 999,
                }}
              />
            </div>
            <span className={`font-display text-[24px] leading-none tabular min-w-[50px] text-right ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>
              {timeLeft}s
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-5">
        <div className="max-w-xl mx-auto">
          <div key={questionShake} className={`btl btl-lg sh-6 p-5 mb-5 ${questionShake ? 'anim-shake' : ''}`} style={{ background: '#fff' }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-12 h-12 btl btl-sm grid place-items-center" style={{ background: 'var(--ink)', color: '#fff', borderWidth: 2.5 }}>
                <span className="font-display text-[20px] leading-none">?</span>
              </span>
              <span className="font-mono text-[12px] font-bold uppercase tracking-[0.25em] opacity-60">Pitanje {quiz.currentIndex + 1}</span>
            </div>
            <div className="font-display text-[25px] leading-tight tracking-tight">{question.question}</div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {question.options.map((option, index) => {
              const isCorrect = option.correct
              const isSelected = selected === index
              const isGone = eliminated.includes(index)
              let bg = '#fff'
              let opacity = 1

              if (revealed) {
                if (isCorrect) bg = '#dcfce7'
                else if (isSelected) bg = '#fee2e2'
                else opacity = 0.5
              } else if (isGone) {
                bg = '#f3f4f6'
                opacity = 0.35
              }

              return (
                <button
                  key={index}
                  onClick={() => !isGone && handleAnswer(index)}
                  disabled={revealed || isGone}
                  className="btl p-4 flex items-center gap-4 text-left transition-transform disabled:cursor-default"
                  style={{
                    background: bg,
                    boxShadow: '5px 5px 0 0 var(--line)',
                    opacity,
                    textDecoration: isGone ? 'line-through' : 'none',
                  }}
                >
                  <span
                    className="shrink-0 w-14 h-14 btl btl-sm grid place-items-center font-display text-[22px]"
                    style={{
                      background: revealed && isCorrect ? '#16a34a' : revealed && isSelected ? '#dc2626' : 'var(--ink)',
                      color: '#fff',
                      borderWidth: 2.5,
                    }}
                  >
                    {revealed && isCorrect ? <Icon name="check" className="w-5 h-5" stroke={3} /> : revealed && isSelected ? <Icon name="x" className="w-5 h-5" stroke={3} /> : OPTION_LETTERS[index]}
                  </span>
                  <span className="font-display text-[18px] leading-tight flex-1">{option.text}</span>
                </button>
              )
            })}
          </div>

          {error && (
            <div className="btl p-3 mt-4 font-mono text-[11px] font-bold" style={{ background: '#fecaca', borderColor: '#dc2626' }}>
              {error}
            </div>
          )}
          {powerupFlash && (
            <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(178px+env(safe-area-inset-bottom))] z-30 btl sh-3 px-4 py-2 font-mono text-[11px] font-bold" style={{ background: '#fff' }}>
              {powerupFlash}
            </div>
          )}
          {doubleXpActive && !powerupFlash && (
            <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(178px+env(safe-area-inset-bottom))] z-30 chip" style={{ background: '#fde68a' }}>
              ⚡ 2× XP aktivno
            </div>
          )}
        </div>
      </div>
      <PowerupFab disabled={revealed || submitting} onUse={usePowerup} />
    </div>
  )
}
