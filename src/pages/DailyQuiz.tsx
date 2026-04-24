import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import Icon from '../components/Icon'
import { useLoadingOverlay } from '../context/LoadingOverlayContext'

function formatCountdown(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':')
}

const DAILY_QUESTION_COUNT = 30

export default function DailyQuiz() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [daily, setDaily] = useState<any>(null)
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    let active = true

    Promise.all([api.auth.getUser(), api.quiz.daily()])
      .then(([nextUser, nextDaily]) => {
        if (!active) return
        setUser(nextUser)
        setDaily(nextDaily)
        setLoading(false)
      })
      .catch(err => {
        if (!active) return
        setError(err.message || 'Greška pri učitavanju dnevnog kviza')
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const next = new Date(now)
      next.setHours(24, 0, 0, 0)
      setSecondsLeft(Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000)))
    }

    updateCountdown()
    const timer = window.setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [])

  const dateLabel = useMemo(() => {
    const source = daily?.quiz_date ? new Date(daily.quiz_date) : new Date()
    return source.toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
  }, [daily?.quiz_date])

  async function handleStart() {
    if (!user) {
      navigate('/signin')
      return
    }

    setStarting(true)
    try {
      const session = await api.quiz.startDaily()
      navigate('/quiz/play', {
        state: {
          session: {
            session_id: session.session_id,
            questions: session.questions,
            category_id: 'daily',
            session_type: 'daily',
          },
          categoryLabel: 'DNEVNI KVIZ',
          isDaily: true,
          returnTo: '/daily',
        },
      })
    } catch (err: any) {
      if (err.message === 'Daily quiz already completed') {
        const refreshed = await api.quiz.daily().catch(() => null)
        if (refreshed) setDaily(refreshed)
      } else {
        setError(err.message || 'Neuspjelo pokretanje dnevnog kviza')
      }
      setStarting(false)
    }
  }

  useLoadingOverlay(loading || starting, { message: starting ? 'PRIPREMAM KVIZ' : 'UČITAVAM DNEVNI KVIZ' })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="text-center">
          <div className="text-[56px] leading-none anim-bob mb-3">📅</div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-widest opacity-60">Učitavam dnevni kviz</div>
        </div>
      </div>
    )
  }

  if (error && !daily) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--paper)' }}>
        <div className="btl sh-4 p-5 max-w-sm text-center" style={{ background: '#fff' }}>
          <div className="font-display text-[20px] mb-2">Dnevni kviz nije dostupan</div>
          <div className="font-mono text-[11px] opacity-60 mb-4">{error}</div>
          <button onClick={() => navigate('/')} className="btn btn-primary">Početna</button>
        </div>
      </div>
    )
  }

  const completion = daily?.completion
  const dayNumber = String(new Date(daily?.quiz_date || Date.now()).getDate()).padStart(2, '0')

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <div className="flex-1 overflow-y-auto no-scrollbar app-scroll-with-nav">
        <div className="max-w-xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/')} className="btl btl-sm sh-2 w-9 h-9 grid place-items-center" style={{ background: '#fff' }}>
              <Icon name="back" className="w-4 h-4" stroke={2.2} />
            </button>
            <h1 className="font-display text-[22px]">Dnevni kviz</h1>
          </div>

          <div className="btl btl-lg sh-ink-acc p-6 text-center mb-4" style={{ background: 'var(--accent)' }}>
            <div className="text-[70px] leading-none anim-bob">📅</div>
            <div className="font-display text-[54px] leading-none tracking-tight mt-2">Q#{dayNumber}</div>
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] opacity-70 mt-2">
              {dateLabel}
            </div>
            <div className="mt-5 flex items-center justify-center gap-1.5 font-mono text-[12px] font-bold uppercase tracking-wider">
              <Icon name="clock" className="w-4 h-4" stroke={2.3} />
              Novi za {formatCountdown(secondsLeft)}
            </div>
          </div>

          <div className="btl sh-4 p-4 mb-4" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-[11px] font-bold uppercase tracking-widest opacity-60">// Pravila</div>
              <span className="font-mono text-[11px] font-bold tabular">{DAILY_QUESTION_COUNT} Q · 20s</span>
            </div>
            <div className="flex flex-col gap-2">
              {[
                'Miješana pitanja iz svih kategorija',
                'Samo jedan pokušaj dnevno',
                'Bonus XP za brze odgovore',
                'Rezultat ide na dnevnu ljestvicu',
              ].map((rule, index) => (
                <div key={rule} className="flex items-center gap-3">
                  <span className="w-7 h-7 btl btl-sm grid place-items-center font-mono text-[11px] font-bold" style={{ background: 'var(--accent)', borderWidth: 2 }}>
                    {index + 1}
                  </span>
                  <span className="font-display text-[15px] leading-tight">{rule}</span>
                </div>
              ))}
            </div>
          </div>

          {daily?.already_completed ? (
            <div className="space-y-3">
              <div className="btl sh-4 p-4" style={{ background: '#fff' }}>
                <div className="font-mono text-[11px] font-bold uppercase tracking-widest opacity-60 mb-2">// Današnji rezultat</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="btl sh-2 p-3" style={{ background: '#dcfce7' }}>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">Točni</div>
                    <div className="font-display text-[28px] leading-none mt-1">{completion?.correct_count ?? 0}/{DAILY_QUESTION_COUNT}</div>
                  </div>
                  <div className="btl sh-2 p-3" style={{ background: '#fff7cc' }}>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">Score</div>
                    <div className="font-display text-[28px] leading-none mt-1">{completion?.score ?? 0}</div>
                  </div>
                </div>
                <div className="font-mono text-[11px] opacity-60 mt-3">Dnevni kviz je već riješen. Novi set dolazi nakon ponoći.</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => navigate('/leaderboard?type=daily')} className="btn" style={{ background: '#fde68a' }}>
                  Ljestvica
                </button>
                <button onClick={() => navigate('/')} className="btn btn-primary">
                  Početna
                </button>
              </div>
            </div>
          ) : (
            <>
              {!user && (
                <div className="btl p-3 mb-4 font-mono text-[11px] font-bold" style={{ background: '#fff7cc', borderColor: '#f59e0b' }}>
                  Za dnevni kviz treba prijava kako bi rezultat bio spremljen na ljestvicu.
                </div>
              )}
              {error && (
                <div className="btl p-3 mb-4 font-mono text-[11px] font-bold" style={{ background: '#fecaca', borderColor: '#dc2626' }}>
                  {error}
                </div>
              )}
              <button onClick={handleStart} disabled={starting} className="btn btn-primary w-full" style={{ padding: '18px', fontSize: 16 }}>
                <Icon name="play" className="w-4 h-4" stroke={2.2} />
                {starting ? 'Pokrećem…' : 'IGRAJ DNEVNI KVIZ'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
