import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [myRank, setMyRank] = useState<any>(null)

  useEffect(() => {
    api.auth.getUser().then(u => {
      if (!u) { navigate('/signin'); return }
      setUser(u)
      api.leaderboard.get('alltime').then(d => setMyRank(d.my_rank)).catch(() => {})
    })
  }, [navigate])

  if (!user) return null

  const xp = myRank?.xp ?? 0
  const rank = myRank?.rank ?? '–'
  const quizzes = myRank?.total_quizzes ?? 0

  function handleSignOut() {
    api.auth.logout()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <header className="px-4 pt-4 pb-3 border-b-[2.5px] sticky top-0 z-10"
        style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <h1 className="font-display text-[22px]">Profil</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar max-w-xl mx-auto w-full px-4 py-4 space-y-3 app-scroll-with-nav">
        {/* Avatar card */}
        <div className="btl btl-lg sh-ink-acc p-5 text-center" style={{ background: '#fff' }}>
          <div className="w-20 h-20 btl btl-sm grid place-items-center font-bold text-[36px] mx-auto mb-3"
            style={{ background: 'var(--accent)' }}>
            {user.first_name?.[0]?.toUpperCase()}
          </div>
          <div className="font-display text-[24px] leading-tight">{user.first_name} {user.last_name}</div>
          <div className="font-mono text-[10px] opacity-60 uppercase tracking-widest mt-1">{user.email}</div>
          <div className="mt-3 btl-sm btl" style={{ background: 'var(--paper)', padding: 2, height: 12, borderRadius: 999 }}>
            <div style={{
              height: '100%', width: `${Math.min(100, (xp % 500) / 5)}%`,
              borderRadius: 999, background: 'var(--accent)', border: '1.5px solid var(--line)',
              minWidth: xp > 0 ? 8 : 0,
            }} />
          </div>
          <div className="font-mono text-[10px] font-bold tabular mt-1 opacity-60">{xp} XP</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'RANK', value: `#${rank}`, tone: '#fff' },
            { label: 'XP', value: xp, tone: 'var(--accent)' },
            { label: 'KVIZOVA', value: quizzes, tone: '#fff' },
          ].map(s => (
            <div key={s.label} className="btl sh-3" style={{ background: s.tone, padding: '12px 14px' }}>
              <div className="font-mono text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">{s.label}</div>
              <div className="font-display text-[20px] leading-none tabular">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="btl sh-3 p-2" style={{ background: '#fff' }}>
          <div className="font-mono text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60 px-1 pt-1">// POSTAVKE</div>
          <Link to="/subscribe"
            className="w-full flex items-center gap-3 py-2.5 px-1 text-left border-b-[1.5px]"
            style={{ borderColor: 'rgba(0,0,0,.08)' }}>
            <div className="btl btl-sm w-9 h-9 grid place-items-center" style={{ background: '#fde68a', borderWidth: 2 }}>👑</div>
            <div className="flex-1 font-display text-[14px]">Pretplata</div>
            <span className="font-mono text-[10px] opacity-60">›</span>
          </Link>
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 py-2.5 px-1 text-left">
            <div className="btl btl-sm w-9 h-9 grid place-items-center" style={{ background: '#fecaca', borderWidth: 2 }}>↩</div>
            <div className="flex-1 font-display text-[14px]" style={{ color: '#dc2626' }}>Odjava</div>
          </button>
        </div>

        <div className="text-center font-mono text-[9px] opacity-40 uppercase tracking-widest">
          // QUIZZO CLUB v1.0 · 2026
        </div>
      </div>
    </div>
  )
}
