import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

function AnimatedNumber({ target }: { target: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = Math.ceil(target / 30)
    const t = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(t) }
      else setVal(start)
    }, 30)
    return () => clearInterval(t)
  }, [target])
  return <>{val}</>
}

export default function QuizResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as any
  const [challengeResult, setChallengeResult] = useState<any>(null)

  useEffect(() => {
    if (!state) { navigate('/'); return }
    if (state.challenge_id) {
      api.challenges.complete(state.challenge_id).then(r => setChallengeResult(r)).catch(() => {})
    }
  }, [])

  if (!state) return null

  const { session, xp_earned, percentage, answers } = state
  const correct = session?.correct_count ?? 0
  const total = session?.total_questions ?? 10
  const score = session?.score ?? 0
  const pct = percentage ?? Math.round((correct / total) * 100)

  const grade = pct >= 90 ? { label: 'SAVRŠENO', emoji: '🏆', tone: '#fde68a' }
    : pct >= 70 ? { label: 'SJAJNO', emoji: '🎉', tone: '#bbf7d0' }
    : pct >= 50 ? { label: 'DOBRO', emoji: '👍', tone: '#ddd6fe' }
    : { label: 'VJEŽBAJ', emoji: '💪', tone: '#fecaca' }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--paper)' }}>
      <div className="w-full max-w-md anim-screenIn">
        {/* Main card */}
        <div className="btl btl-lg sh-ink-acc p-5 mb-3 text-center" style={{ background: grade.tone }}>
          <div className="text-[54px] leading-none mb-1 anim-pop">{grade.emoji}</div>
          <div className="font-display text-[32px] tracking-tight leading-none mt-1">{grade.label}</div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-widest opacity-60 mt-1">
            {correct}/{total} TOČNIH
          </div>
          <div className="mt-4 flex items-end justify-center gap-1">
            <div className="font-display tabular text-[80px] leading-none tracking-tighter">
              <AnimatedNumber target={pct} />
            </div>
            <div className="font-display text-[30px] leading-none pb-2 opacity-60">%</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="btl sh-3" style={{ background: 'var(--ink)', color: '#fff', padding: '12px 14px' }}>
            <div className="font-mono text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">SCORE</div>
            <div className="font-display tabular text-[20px] leading-none"><AnimatedNumber target={score} /></div>
          </div>
          <div className="btl sh-3" style={{ background: 'var(--accent)', padding: '12px 14px' }}>
            <div className="font-mono text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">+XP</div>
            <div className="font-display tabular text-[20px] leading-none">+<AnimatedNumber target={xp_earned ?? 0} /></div>
          </div>
          <div className="btl sh-3" style={{ background: '#fff', padding: '12px 14px' }}>
            <div className="font-mono text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">TOČNI</div>
            <div className="font-display tabular text-[20px] leading-none">{correct}/{total}</div>
          </div>
        </div>

        {/* Challenge result */}
        {challengeResult?.status === 'waiting' && (
          <div className="btl sh-3 p-4 mb-3 text-center" style={{ background: '#fff' }}>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest">⏳ Čekamo protivnika…</p>
            <p className="font-mono text-[10px] opacity-60 mt-1">Pošalji link prijatelju!</p>
          </div>
        )}
        {challengeResult?.status === 'completed' && (
          <div className="btl sh-3 p-4 mb-3 text-center" style={{ background: '#fff' }}>
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest mb-3">// Rezultat izazova</div>
            <div className="flex justify-center gap-6">
              <div>
                <div className="font-display text-[32px] leading-none tabular">{challengeResult.challenger_correct ?? '?'}</div>
                <div className="font-mono text-[10px] opacity-60">TI</div>
              </div>
              <div className="font-display text-[24px] self-center opacity-30">VS</div>
              <div>
                <div className="font-display text-[32px] leading-none tabular">{challengeResult.challenged_correct ?? '?'}</div>
                <div className="font-mono text-[10px] opacity-60">PROTIVNIK</div>
              </div>
            </div>
          </div>
        )}

        {/* Answer breakdown */}
        {answers?.length > 0 && (
          <div className="btl sh-4 p-3 mb-3" style={{ background: '#fff' }}>
            <div className="font-mono text-[11px] font-bold uppercase tracking-widest mb-2">// Pregled odgovora</div>
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto no-scrollbar">
              {answers.map((a: any, i: number) => (
                <div key={i} className="btl btl-sm flex items-center gap-2 px-2.5 py-1.5" style={{
                  background: a.correct ? '#dcfce7' : '#fee2e2',
                  boxShadow: '2px 2px 0 0 var(--line)'
                }}>
                  <span className="w-5 h-5 btl btl-sm grid place-items-center text-[10px] font-bold" style={{
                    background: a.correct ? '#16a34a' : '#dc2626', color: '#fff', borderWidth: 1.5
                  }}>
                    {a.correct ? '✓' : '✗'}
                  </span>
                  <span className="font-mono text-[11px] font-bold truncate flex-1">{a.question}</span>
                  {a.correct && <span className="font-mono text-[11px] font-bold tabular" style={{ color: '#16a34a' }}>+{a.points}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={() => navigate(-2)} className="btn">▶ Igraj opet</button>
          <Link to="/" className="btn btn-primary text-center">⌂ Početna</Link>
        </div>
        <Link to="/leaderboard" className="btn w-full text-center" style={{ background: '#fde68a' }}>
          🏆 Pogledaj ljestvicu
        </Link>
      </div>
    </div>
  )
}
