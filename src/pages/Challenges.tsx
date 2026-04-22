import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api } from '../lib/api'

type Mode = 'challenge' | 'hunter'

const modeInfo = {
  challenge: {
    label: 'Izazov',
    emoji: '⚔️',
    desc: 'Oboje odgovarate na ista pitanja, pobjeđuje točniji.',
  },
  hunter: {
    label: 'Hunter Mode',
    emoji: '🎯',
    desc: 'Svaki igrač dobiva različita pitanja iz iste kategorije. Pobjeđuje bolji lov!',
  },
}

export default function Challenges() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const joinCode = searchParams.get('code')

  const [user, setUser] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState('')
  const [mode, setMode] = useState<Mode>('challenge')
  const [creating, setCreating] = useState(false)
  const [shareCode, setShareCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinChallengeCode, setJoinChallengeCode] = useState(joinCode || '')
  const [challengeInfo, setChallengeInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.auth.getUser(),
      api.quiz.categories(),
    ]).then(([u, cats]) => {
      setUser(u)
      setCategories(cats.categories)
      if (cats.categories.length) setSelectedCat(cats.categories[0].id)
    })

    if (joinCode) {
      lookupChallenge(joinCode)
    }
  }, [])

  async function lookupChallenge(code: string) {
    setLoading(true)
    try {
      const data = await api.challenges.get(code)
      setChallengeInfo(data.challenge)
    } catch {
      setChallengeInfo(null)
    }
    setLoading(false)
  }

  async function handleCreate() {
    if (!user) { navigate('/signin'); return }
    if (!selectedCat) return
    setCreating(true)
    try {
      const data = await api.challenges.create(selectedCat, mode)
      setShareCode(data.share_code)
      navigate('/quiz/play', {
        state: {
          session: {
            session_id: data.session_id,
            questions: data.questions,
            challenge_id: data.challenge_id,
          },
        },
      })
    } catch (err: any) {
      alert(err.message || 'Greška')
      setCreating(false)
    }
  }

  async function handleJoin() {
    if (!user) { navigate('/signin'); return }
    const code = joinChallengeCode.trim().toUpperCase()
    if (!code) return
    setJoining(true)
    try {
      const data = await api.challenges.accept(code)
      navigate('/quiz/play', {
        state: {
          session: {
            session_id: data.session_id,
            questions: data.questions,
            challenge_id: data.challenge_id,
          },
        },
      })
    } catch (err: any) {
      alert(err.message || 'Izazov nije pronađen')
      setJoining(false)
    }
  }

  const selectedCatData = categories.find(c => c.id === selectedCat)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-gray-950/80 backdrop-blur border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-white/40 hover:text-white/70 transition-colors">←</Link>
          <h1 className="text-white font-black text-lg">Izazovi</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Join a challenge */}
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <h2 className="text-white font-bold text-lg mb-4">📨 Prihvati izazov</h2>
          <p className="text-white/50 text-sm mb-4">
            Netko ti je poslao link ili kod? Unesi ga ovdje.
          </p>
          <div className="flex gap-2">
            <input
              value={joinChallengeCode}
              onChange={e => {
                setJoinChallengeCode(e.target.value.toUpperCase())
                if (e.target.value.length === 10) lookupChallenge(e.target.value)
              }}
              placeholder="Unesi kod (npr. A1B2C3)"
              maxLength={10}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-500 tracking-widest font-mono"
            />
            <button
              onClick={handleJoin}
              disabled={joining || !joinChallengeCode.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {joining ? '…' : 'Prihvati'}
            </button>
          </div>
          {challengeInfo && (
            <div className="mt-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <p className="text-white/80 text-sm">
                <strong>{challengeInfo.challenger_name}</strong> te izaziva u kategoriji{' '}
                <strong>{challengeInfo.category_emoji} {challengeInfo.category_name}</strong>
                {' '}({modeInfo[challengeInfo.mode as Mode]?.label || challengeInfo.mode})
              </p>
            </div>
          )}
        </section>

        {/* Create a challenge */}
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <h2 className="text-white font-bold text-lg mb-4">🆕 Stvori izazov</h2>

          {/* Mode selection */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {(Object.entries(modeInfo) as [Mode, typeof modeInfo['challenge']][]).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  mode === key
                    ? 'bg-indigo-600/30 border-indigo-500/60'
                    : 'bg-white/3 border-white/10 hover:bg-white/8'
                }`}
              >
                <div className="text-2xl mb-1">{info.emoji}</div>
                <div className="text-white font-semibold text-sm">{info.label}</div>
                <div className="text-white/40 text-xs mt-0.5 leading-snug">{info.desc}</div>
              </button>
            ))}
          </div>

          {/* Category selection */}
          <div className="mb-5">
            <label className="text-white/60 text-sm block mb-2">Kategorija</label>
            <div className="grid grid-cols-3 gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    selectedCat === cat.id
                      ? 'bg-indigo-600/30 border-indigo-500/60'
                      : 'bg-white/3 border-white/10 hover:bg-white/8'
                  }`}
                >
                  <div className="text-xl">{cat.emoji}</div>
                  <div className="text-white text-xs mt-0.5 font-medium leading-tight">{cat.name}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !selectedCat}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors disabled:opacity-50"
          >
            {creating ? '…' : `Stvori ${modeInfo[mode].label}`}
          </button>

          {shareCode && (
            <div className="mt-4 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
              <p className="text-white/60 text-sm mb-2">Pošalji ovaj kod prijatelju</p>
              <div className="text-white font-black text-3xl tracking-widest font-mono mb-3">{shareCode}</div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/challenges?code=${shareCode}`)
                  alert('Link kopiran!')
                }}
                className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-xl transition-colors"
              >
                📋 Kopiraj link
              </button>
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="bg-white/3 border border-white/5 rounded-3xl p-6">
          <h2 className="text-white/70 font-semibold mb-4">Kako funkcionira?</h2>
          <div className="space-y-3 text-sm text-white/50">
            <div className="flex gap-3">
              <span className="text-lg">1️⃣</span>
              <p>Odaberi kategoriju i mod, klikni "Stvori izazov".</p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg">2️⃣</span>
              <p>Odmah rješavaš svoja pitanja.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg">3️⃣</span>
              <p>Pošalji prijatelju dobiveni kod. On/ona ga upiše i odgovara na pitanja.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg">4️⃣</span>
              <p>Nakon što oboje završite, vidite tko je pobijedio — više točnih odgovora pobjeđuje!</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
