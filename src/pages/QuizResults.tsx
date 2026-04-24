import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import Icon from '../components/Icon'

function AnimatedNumber({ target }: { target: number }) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let current = 0
    const step = Math.max(1, Math.ceil(target / 30))
    const timer = window.setInterval(() => {
      current += step
      if (current >= target) {
        setValue(target)
        window.clearInterval(timer)
      } else {
        setValue(current)
      }
    }, 28)
    return () => clearInterval(timer)
  }, [target])

  return <>{value}</>
}

function StatCard({ label, value, bg, color = '#111014' }: { label: string; value: React.ReactNode; bg: string; color?: string }) {
  return (
    <div className="btl sh-3 p-4" style={{ background: bg, color }}>
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-2">{label}</div>
      <div className="font-display text-[28px] leading-none tabular">{value}</div>
    </div>
  )
}

export default function QuizResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = (location.state as any) || null
  const [challengeResult, setChallengeResult] = useState<any>(null)
  const [hotTopicResult, setHotTopicResult] = useState<any>(null)
  const hotTopicCompletedRef = useRef(false)

  useEffect(() => {
    if (!state) {
      navigate('/')
      return
    }
    if (state.challenge_id) {
      api.challenges.complete(state.challenge_id).then(setChallengeResult).catch(() => {})
    }
    if (state.hotTopic?.slug && state.session?.id && !hotTopicCompletedRef.current) {
      hotTopicCompletedRef.current = true
      api.hotTopics.complete(state.hotTopic.slug, state.session.id).then(setHotTopicResult).catch(() => {})
    }
  }, [state, navigate])

  const grade = useMemo(() => {
    const pct = state?.percentage ?? 0
    if (pct >= 90) return { label: 'SAVRŠENO', emoji: '🏆', tone: '#fde68a' }
    if (pct >= 70) return { label: 'SJAJNO', emoji: '🎉', tone: '#bbf7d0' }
    if (pct >= 50) return { label: 'DOBRO', emoji: '👍', tone: '#ddd6fe' }
    return { label: 'VJEŽBAJ', emoji: '💪', tone: '#fecaca' }
  }, [state?.percentage])

  if (!state) return null

  const session = state.session || {}
  const correct = session.correct_count ?? 0
  const total = session.total_questions ?? 10
  const score = session.score ?? 0
  const percentage = state.percentage ?? Math.round((correct / Math.max(total, 1)) * 100)
  const xpEarned = state.xp_earned ?? 0
  const answers = state.answers || []
  const categoryLabel = state.categoryLabel || 'KVIZ'
  const replayTarget = state.isDaily ? '/daily' : (state.returnTo || '/')

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-5">
        <div className="max-w-xl mx-auto">
          <div className="btl btl-lg sh-ink-acc p-6 mb-4 text-center" style={{ background: grade.tone }}>
            <div className="text-[64px] leading-none mb-2 anim-pop">{grade.emoji}</div>
            <div className="font-display text-[40px] leading-none tracking-tight">{grade.label}</div>
            <div className="font-mono text-[12px] font-bold uppercase tracking-[0.22em] opacity-60 mt-3">
              {categoryLabel} · {correct}/{total} TOČNIH
            </div>
            <div className="mt-6 flex items-end justify-center gap-1">
              <div className="font-display text-[92px] leading-none tracking-tighter tabular">
                <AnimatedNumber target={percentage} />
              </div>
              <div className="font-display text-[34px] leading-none pb-3 opacity-60">%</div>
            </div>
          </div>

          <div className={`grid gap-3 mb-4 ${hotTopicResult ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
            <StatCard label="SCORE" value={<AnimatedNumber target={score} />} bg="var(--ink)" color="#fff" />
            <StatCard label="+XP" value={<>+<AnimatedNumber target={xpEarned} /></>} bg="var(--accent)" />
            <StatCard label="TOČNI" value={`${correct}/${total}`} bg="#fff" />
            {hotTopicResult && (
              <StatCard label="HOT TOPIC" value={`+${hotTopicResult.leaderboard_points_awarded || 0}`} bg="#fce7f3" />
            )}
          </div>

          {challengeResult?.status === 'waiting' && (
            <div className="btl sh-3 p-4 mb-4 text-center" style={{ background: '#fff7cc' }}>
              <div className="font-mono text-[11px] font-bold uppercase tracking-widest mb-1">Čekamo protivnika</div>
              <div className="font-mono text-[10px] opacity-60">Rezultat će se zaključiti kada i druga strana odigra svoj pokušaj.</div>
            </div>
          )}

          {challengeResult?.status === 'completed' && (
            <div className="btl sh-3 p-4 mb-4" style={{ background: '#fff' }}>
              <div className="font-mono text-[11px] font-bold uppercase tracking-widest opacity-60 mb-3">// Rezultat izazova</div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="btl sh-2 p-3" style={{ background: '#eef2ff' }}>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Ti</div>
                  <div className="font-display text-[30px] leading-none tabular">{challengeResult.challenger_correct ?? challengeResult.challenged_correct ?? '?'}</div>
                </div>
                <div className="btl sh-2 p-3" style={{ background: '#f3f4f6' }}>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Protivnik</div>
                  <div className="font-display text-[30px] leading-none tabular">{challengeResult.challenged_correct ?? challengeResult.challenger_correct ?? '?'}</div>
                </div>
              </div>
            </div>
          )}

          {hotTopicResult && (
            <div className="btl sh-3 p-4 mb-4" style={{ background: '#fff' }}>
              <div className="font-mono text-[11px] font-bold uppercase tracking-widest opacity-60 mb-3">// Hot topic rezultat</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="btl sh-2 p-3" style={{ background: '#fce7f3' }}>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Bodovi</div>
                  <div className="font-display text-[30px] leading-none tabular">+{hotTopicResult.leaderboard_points_awarded || 0}</div>
                </div>
                <div className="btl sh-2 p-3" style={{ background: '#eef2ff' }}>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Tjedni rank</div>
                  <div className="font-display text-[30px] leading-none tabular">{hotTopicResult.me?.weekly?.rank ? `#${hotTopicResult.me.weekly.rank}` : '—'}</div>
                </div>
              </div>
            </div>
          )}

          {answers.length > 0 && (
            <div className="btl sh-4 p-4 mb-4" style={{ background: '#fff' }}>
              <div className="font-mono text-[11px] font-bold uppercase tracking-widest mb-3">// Pregled odgovora</div>
              <div className="flex flex-col gap-2">
                {answers.map((answer: any, index: number) => (
                  <div key={index} className="btl btl-sm flex items-center gap-3 px-3 py-3" style={{
                    background: answer.correct ? '#dcfce7' : '#fee2e2',
                    boxShadow: '3px 3px 0 0 var(--line)',
                  }}>
                    <span className="w-10 h-10 shrink-0 rounded-full grid place-items-center" style={{
                      background: answer.correct ? '#22c55e' : '#ef4444',
                      color: '#fff',
                      border: '2px solid var(--line)',
                    }}>
                      <Icon name={answer.correct ? 'check' : 'x'} className="w-4 h-4" stroke={2.8} />
                    </span>
                    <span className="font-mono text-[12px] font-bold flex-1 truncate">{answer.question}</span>
                    {answer.correct && (
                      <span className="font-mono text-[12px] font-bold tabular" style={{ color: '#16a34a' }}>
                        +{answer.points}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <button onClick={() => navigate(replayTarget)} className="btn">
              <Icon name="play" className="w-4 h-4" stroke={2.2} />
              Igraj opet
            </button>
            <Link to="/" className="btn btn-primary text-center">
              <Icon name="home" className="w-4 h-4" stroke={2.2} />
              Početna
            </Link>
          </div>
          <Link to={state.hotTopic?.slug ? `/hot-topics/${state.hotTopic.slug}` : (state.isDaily ? '/leaderboard?type=daily' : '/leaderboard')} className="btn w-full text-center" style={{ background: '#fde68a' }}>
            <Icon name="crown" className="w-4 h-4" stroke={2.2} />
            Ljestvica
          </Link>
        </div>
      </div>
    </div>
  )
}
