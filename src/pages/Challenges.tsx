import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api } from '../lib/api'

type Mode = 'challenge' | 'hunter'

const MODES = {
  challenge: { emoji: '⚔️', label: 'Izazov', desc: 'Ista pitanja, pobjeđuje točniji.' },
  hunter:    { emoji: '🎯', label: 'Hunter Mode', desc: 'Različita pitanja, ista kategorija.' },
}

const CATEGORIES = [
  { id: 'geography',   emoji: '🌍', name: 'Geografija',      hue: 220 },
  { id: 'history',     emoji: '📚', name: 'Povijest',        hue: 35  },
  { id: 'sports',      emoji: '⚽', name: 'Sport',           hue: 150 },
  { id: 'science',     emoji: '🔬', name: 'Priroda i Znan.', hue: 280 },
  { id: 'film_music',  emoji: '🎬', name: 'Film i Glazba',   hue: 345 },
  { id: 'pop_culture', emoji: '🎭', name: 'Pop Kultura',     hue: 25  },
]

export default function Challenges() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const joinCode = searchParams.get('code')

  const [user, setUser] = useState<any>(null)
  const [selectedCat, setSelectedCat] = useState('geography')
  const [mode, setMode] = useState<Mode>('challenge')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinCode_, setJoinCode] = useState(joinCode || '')
  const [challengeInfo, setChallengeInfo] = useState<any>(null)
  const [shareCode, setShareCode] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.auth.getUser().then(setUser)
    if (joinCode) lookupChallenge(joinCode)
  }, [])

  async function lookupChallenge(code: string) {
    try { const d = await api.challenges.get(code); setChallengeInfo(d.challenge) } catch { setChallengeInfo(null) }
  }

  async function handleCreate() {
    if (!user) { navigate('/signin'); return }
    setCreating(true)
    try {
      const data = await api.challenges.create(selectedCat, mode)
      setShareCode(data.share_code)
      navigate('/quiz/play', { state: { session: { session_id: data.session_id, questions: data.questions, challenge_id: data.challenge_id } } })
    } catch (err: any) { alert(err.message || 'Greška'); setCreating(false) }
  }

  async function handleJoin() {
    if (!user) { navigate('/signin'); return }
    const code = joinCode_.trim().toUpperCase()
    if (!code) return
    setJoining(true)
    try {
      const data = await api.challenges.accept(code)
      navigate('/quiz/play', { state: { session: { session_id: data.session_id, questions: data.questions, challenge_id: data.challenge_id } } })
    } catch (err: any) { alert(err.message || 'Izazov nije pronađen'); setJoining(false) }
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/challenges?code=${shareCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <header className="px-4 pt-4 pb-3 border-b-[2.5px] sticky top-0 z-10" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <Link to="/" className="btl btl-sm sh-2 w-9 h-9 grid place-items-center" style={{ background: '#fff' }}>←</Link>
          <h1 className="font-display text-[22px]">Izazovi</h1>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-4 space-y-3">
        {/* Accept */}
        <div className="btl sh-4 p-4" style={{ background: '#fff' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>✉</span>
            <div className="font-display text-[15px]">Prihvati izazov</div>
          </div>
          <div className="font-mono text-[10px] opacity-60 uppercase tracking-wider mb-2">Upiši kod prijatelja</div>
          <div className="flex gap-2">
            <input
              value={joinCode_}
              onChange={e => {
                const v = e.target.value.toUpperCase()
                setJoinCode(v)
                if (v.length >= 8) lookupChallenge(v)
              }}
              placeholder="UNESI KOD"
              maxLength={10}
              className="inp flex-1 tracking-[0.2em]"
            />
            <button onClick={handleJoin} disabled={joining || !joinCode_.trim()} className="btn btn-primary">
              {joining ? '…' : 'Prihvati'}
            </button>
          </div>
          {challengeInfo && (
            <div className="btl btl-sm mt-2 p-2.5 anim-pop" style={{ background: 'var(--accent-soft)' }}>
              <span className="font-mono text-[11px] font-bold">
                {challengeInfo.challenger_name} te izaziva u {challengeInfo.category_emoji} {challengeInfo.category_name}
              </span>
            </div>
          )}
        </div>

        {/* Create */}
        <div className="btl sh-4 p-4" style={{ background: '#fff' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="chip" style={{ background: 'var(--accent)' }}>+</span>
            <div className="font-display text-[15px]">Stvori izazov</div>
          </div>

          <div className="font-mono text-[10px] opacity-60 uppercase tracking-wider mb-2">Odaberi mod</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(Object.entries(MODES) as [Mode, typeof MODES['challenge']][]).map(([key, m]) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className="btl p-3 text-left"
                style={{
                  background: mode === key ? 'var(--accent)' : '#fff',
                  boxShadow: mode === key ? '4px 4px 0 0 var(--line)' : '2px 2px 0 0 var(--line)'
                }}
              >
                <div className="text-xl mb-1">{m.emoji}</div>
                <div className="font-display text-[13px] leading-tight">{m.label}</div>
                <div className="font-mono text-[9px] opacity-70 mt-0.5 leading-tight">{m.desc}</div>
              </button>
            ))}
          </div>

          <div className="font-mono text-[10px] opacity-60 uppercase tracking-wider mb-2">Kategorija</div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className="btl p-2 text-center"
                style={{
                  background: selectedCat === cat.id ? `oklch(0.9 0.1 ${cat.hue})` : '#fff',
                  boxShadow: selectedCat === cat.id ? '3px 3px 0 0 var(--line)' : '2px 2px 0 0 var(--line)'
                }}
              >
                <div className="text-xl">{cat.emoji}</div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-wider truncate">{cat.name.split(' ')[0]}</div>
              </button>
            ))}
          </div>

          <button onClick={handleCreate} disabled={creating} className="btn btn-primary w-full">
            {creating ? '…' : `Stvori ${MODES[mode].label}`}
          </button>

          {shareCode && (
            <div className="btl btl-sm mt-3 p-3 text-center anim-pop" style={{ background: '#fde68a', borderWidth: 2 }}>
              <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Pošalji prijatelju</div>
              <div className="font-mono font-bold text-[26px] tracking-[0.25em] tabular my-1">{shareCode}</div>
              <button onClick={copyLink} className="btn btn-sm mt-1">
                {copied ? '✓ Kopirano!' : '📋 Kopiraj link'}
              </button>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="btl sh-3 p-4" style={{ background: 'var(--paper-deep)' }}>
          <div className="font-mono text-[10px] font-bold uppercase tracking-widest mb-2">// Kako funkcionira</div>
          {[
            'Odaberi kategoriju i mod',
            'Klikni "Stvori izazov"',
            'Pošalji prijatelju kod',
            'Pobjeđuje tko je točniji!',
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 btl btl-sm grid place-items-center font-mono text-[10px] font-bold" style={{ background: 'var(--accent)', borderWidth: 1.5 }}>{i + 1}</span>
              <span className="text-[12px]">{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
