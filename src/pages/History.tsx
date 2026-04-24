import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import Icon from '../components/Icon'
import Avatar from '../components/Avatar'

type Tab = 'all' | 'wins' | 'losses'

const CATEGORY_META: Record<string, { label: string; icon: string; tone: number }> = {
  geography: { label: 'Geografija', icon: 'globe', tone: 220 },
  history: { label: 'Povijest', icon: 'scroll', tone: 35 },
  sports: { label: 'Sport', icon: 'trophy', tone: 150 },
  science: { label: 'Priroda i Znan.', icon: 'atom', tone: 280 },
  film_music: { label: 'Film i Glazba', icon: 'music', tone: 345 },
  pop_culture: { label: 'Pop Kultura', icon: 'mask', tone: 25 },
}

export default function History() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    api.auth.getUser().then(user => {
      if (!user) {
        navigate('/signin')
        return
      }
      api.challenges.history().then(r => setHistory(r.history)).catch(() => {})
    })
  }, [navigate])

  const wins = history.filter(match => match.result === 'win').length
  const losses = history.filter(match => match.result === 'loss').length
  const ties = history.filter(match => match.result === 'draw').length
  const winRate = history.length ? Math.round((wins / history.length) * 100) : 0

  const filtered = useMemo(() => {
    if (tab === 'wins') return history.filter(match => match.result === 'win')
    if (tab === 'losses') return history.filter(match => match.result === 'loss')
    return history
  }, [history, tab])

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <header className="px-4 pt-4 pb-3 border-b-[2.5px] sticky top-0 z-10" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/friends')} className="btl btl-sm sh-2 w-9 h-9 grid place-items-center" style={{ background: '#fff' }}>
            <Icon name="back" className="w-4 h-4" stroke={2.2} />
          </button>
          <h1 className="font-display text-[22px]">Povijest mečeva</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar max-w-xl mx-auto px-4 py-4 space-y-4 w-full app-scroll-with-nav">
        <div className="btl sh-ink-acc p-5" style={{ background: 'var(--ink)', color: '#fff' }}>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] opacity-60 mb-3">// UKUPAN REKORD</div>
          <div className="flex items-baseline gap-3 mb-3">
            <div className="font-display text-[64px] leading-none tabular">{wins}<span style={{ color: 'var(--accent)' }}>-</span>{losses}</div>
            <div className="font-mono text-[14px] opacity-70 tabular">+{ties}T</div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] font-bold tabular">
            <span style={{ color: 'var(--accent)' }}>{winRate}%</span>
            <span className="opacity-60">WIN RATE</span>
          </div>
          <div className="flex mt-3 h-2 rounded-full overflow-hidden" style={{ border: '1.5px solid #fff' }}>
            <div style={{ width: `${history.length ? (wins / history.length) * 100 : 0}%`, background: 'var(--accent)' }} />
            <div style={{ width: `${history.length ? (ties / history.length) * 100 : 0}%`, background: '#9ca3af' }} />
            <div style={{ width: `${history.length ? (losses / history.length) * 100 : 0}%`, background: 'var(--danger)' }} />
          </div>
        </div>

        <div className="btl sh-3 p-1 flex gap-1" style={{ background: '#fff' }}>
          {[
            { key: 'all', label: 'Sve', count: history.length },
            { key: 'wins', label: 'Pobjede', count: wins },
            { key: 'losses', label: 'Porazi', count: losses },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as Tab)}
              className={`flex-1 py-2 font-mono text-[10px] font-bold uppercase tracking-widest rounded-[10px] flex items-center justify-center gap-1 ${tab === item.key ? '' : 'opacity-50'}`}
              style={tab === item.key ? { background: 'var(--ink)', color: '#fff', border: '1.5px solid var(--line)' } : {}}
            >
              {item.label} <span className="tabular opacity-80">({item.count})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {filtered.map((match, index) => {
            const meta = CATEGORY_META[match.category_id] || CATEGORY_META.geography
            const tone = match.result === 'win' ? '#bbf7d0' : match.result === 'loss' ? '#fecaca' : '#fde68a'
            const label = match.result === 'win' ? 'POBJEDA' : match.result === 'loss' ? 'PORAZ' : 'NERIJEŠENO'
            return (
              <div key={match.id} className="btl sh-2 p-3 anim-slidein" style={{ background: '#fff', animationDelay: `${index * 0.03}s` }}>
                <div className="flex items-center gap-3">
                  <Avatar user={{ first_name: match.opponent_name, avatar_url: match.opponent_avatar_url }} size={44} className="btl btl-sm shrink-0" background="var(--paper-deep)" textClassName="text-[22px]" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[14.5px] leading-tight truncate">{match.opponent_name}</div>
                    <div className="font-mono text-[10px] opacity-60 mt-0.5">{new Date(match.completed_at || match.created_at).toLocaleString('hr-HR')}</div>
                  </div>
                  <span className="chip" style={{ background: tone }}>{label}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="btl btl-sm px-2 py-1 inline-flex items-center gap-1" style={{ background: `oklch(0.92 0.08 ${meta.tone})`, borderWidth: 1.5 }}>
                    <Icon name={meta.icon} className="w-3.5 h-3.5" stroke={2.2} />
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider">{meta.label}</span>
                  </span>
                  <span className="chip">{match.mode === 'hunter' ? 'Hunter' : 'Izazov'}</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="font-display text-[24px] leading-none tabular">{match.my_correct ?? 0} : {match.opponent_correct ?? 0}</div>
                  <span className="chip" style={{ background: 'var(--accent)' }}>+{match.xp_earned ?? 0} XP</span>
                </div>
              </div>
            )
          })}
          {!filtered.length && (
            <div className="btl sh-3 p-8 text-center" style={{ background: '#fff' }}>
              <div className="font-display text-[16px]">Nema mečeva još</div>
              <div className="font-mono text-[10px] opacity-60 mt-1">Izazovi prijatelje i vrati se ovdje</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
