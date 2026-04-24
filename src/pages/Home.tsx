import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import QuizzoLogo from '../components/QuizzoLogo'
import Icon from '../components/Icon'
import { useWallet } from '../context/WalletContext'
import { CORE_CATEGORIES, HOT_TOPIC } from '../data/categories'
import { useNotificationSummary } from '../hooks/useNotificationSummary'
import Avatar from '../components/Avatar'

const WELCOME_TILES = [
  { icon: 'globe', hue: 220 },
  { icon: 'scroll', hue: 35 },
  { icon: 'trophy', hue: 150 },
  { icon: 'atom', hue: 280 },
  { icon: 'music', hue: 345 },
  { icon: 'mask', hue: 25 },
]

export default function Home() {
  const navigate = useNavigate()
  const { wallet, user: walletUser } = useWallet()
  const { unread } = useNotificationSummary()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dailyDone, setDailyDone] = useState(false)
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})
  const [myRank, setMyRank] = useState<any>(null)
  const [liveCount, setLiveCount] = useState(2847)

  useEffect(() => {
    api.auth.getUser().then(currentUser => {
      setUser(currentUser)
      setLoading(false)
      if (currentUser) {
        api.quiz.daily().then(result => setDailyDone(result.already_completed)).catch(() => {})
        api.leaderboard.get('alltime').then(result => setMyRank(result.my_rank)).catch(() => {})
      }
    })

    api.quiz.categories().then(result => {
      const counts: Record<string, number> = {}
      result.categories.forEach((category: any) => {
        counts[category.id] = category.question_count || 0
      })
      setQuestionCounts(counts)
    }).catch(() => {})

    const interval = window.setInterval(() => {
      setLiveCount(count => count + (Math.random() < 0.6 ? 1 : -1))
    }, 2000)

    return () => window.clearInterval(interval)
  }, [])

  if (loading) return null

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)' }}>
        <div className="relative overflow-hidden px-5 pt-10 pb-8" style={{ background: 'var(--ink)', color: '#fff' }}>
          <div className="absolute inset-0 grid-dots opacity-[0.15]" />
          <div className="relative flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <QuizzoLogo size={36} />
              <div>
                <div className="font-display text-[17px] leading-none">Quizzo<span style={{ color: 'var(--accent)' }}>.</span></div>
                <div className="font-mono text-[8.5px] opacity-60 uppercase tracking-[0.25em] mt-0.5">CLUB</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest opacity-80">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
              LIVE · {liveCount.toLocaleString()}
            </div>
          </div>
          <div className="relative">
            <div className="font-display text-[46px] leading-[0.92] tracking-tight" style={{ whiteSpace: 'pre-line' }}>
              {'Opce znanje.\nDnevna doza.'}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60 mt-3">
              // HRVATSKI KVIZ · 2026
            </div>
          </div>
          <div className="relative mt-6 flex gap-2 justify-center">
            {WELCOME_TILES.map((tile, index) => (
              <div
                key={index}
                className="btl shrink-0 grid place-items-center anim-bob"
                style={{
                  width: 44,
                  height: 44,
                  background: `oklch(0.88 0.12 ${tile.hue})`,
                  animationDelay: `${index * 0.15}s`,
                  transform: `rotate(${(index % 2 ? -1 : 1) * (3 + index)}deg)`,
                  boxShadow: '2.5px 2.5px 0 0 var(--accent)',
                  borderColor: '#fff',
                }}
              >
                <Icon name={tile.icon} className="w-6 h-6" stroke={2.1} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 px-5 pt-6 pb-5">
          <div className="space-y-3 mb-6">
            {[
              { n: '01', label: '12 kategorija, 750+ pitanja' },
              { n: '02', label: 'Izazovi protiv prijatelja' },
              { n: '03', label: 'Ljestvica cijele Hrvatske' },
            ].map((item, index) => (
              <div key={item.n} className="flex items-center gap-3 anim-slidein" style={{ animationDelay: `${index * 0.08}s` }}>
                <div className="btl btl-sm w-11 h-11 grid place-items-center shrink-0 font-mono font-bold text-[12px]" style={{ background: 'var(--accent)' }}>
                  {item.n}
                </div>
                <div className="font-display text-[15px] leading-tight">{item.label}</div>
              </div>
            ))}
          </div>

          <button onClick={() => navigate('/signup')} className="btn btn-primary w-full mb-2" style={{ padding: '16px', fontSize: 16 }}>
            Stvori racun →
          </button>
          <button onClick={() => navigate('/signin')} className="btn w-full mb-4" style={{ padding: '13px', fontSize: 14 }}>
            Vec imam racun
          </button>
          <div className="text-center">
            <button onClick={() => navigate('/daily')} className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-50 underline">
              NASTAVI KAO GOST
            </button>
          </div>
        </div>
      </div>
    )
  }

  const day = new Date().getDate()
  const xp = myRank?.xp ?? 0
  const rank = myRank?.rank ?? '–'
  const displayUser = walletUser || user
  const headerHeight = 104
  const totalPowerups = Object.values(wallet.inv || {}).reduce((s: number, v: any) => s + Number(v || 0), 0)

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <div
        className="fixed inset-x-0 top-0 z-40"
        style={{ background: 'var(--paper)', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <header className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QuizzoLogo size={34} />
              <div className="leading-tight">
                <div className="font-display text-[18px] font-bold leading-none">Quizzo<span style={{ color: 'var(--accent-deep)' }}>.</span></div>
                <div className="font-mono text-[9px] font-bold opacity-50 uppercase tracking-[0.2em] mt-0.5">CLUB · v1</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => navigate('/shop')} className="btl btl-sm sh-2 px-2 py-1 flex items-center gap-1" style={{ background: '#fde68a' }}>
                <span className="text-[12px] leading-none">🪙</span>
                <span className="font-mono font-bold text-[11px] tabular">{wallet.coins}</span>
              </button>
              <button onClick={() => navigate('/shop')} className="btl btl-sm sh-2 px-2 py-1 flex items-center gap-1" style={{ background: '#ddd6fe' }}>
                <span className="text-[12px] leading-none">💎</span>
                <span className="font-mono font-bold text-[11px] tabular">{wallet.gems}</span>
              </button>
              <button
                onClick={() => navigate('/shop')}
                className="relative w-9 h-9 btl btl-sm sh-2 grid place-items-center"
                style={{ background: '#fff' }}
              >
                <Icon name="bag" className="w-4 h-4" stroke={2.1} />
                {totalPowerups > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: '#3b82f6', border: '1.5px solid var(--paper)' }} />
                )}
              </button>
              <button
                onClick={() => navigate('/notifications')}
                className="relative w-9 h-9 btl btl-sm sh-2 grid place-items-center"
                style={{ background: '#fff' }}
              >
                <Icon name="bell" className="w-4 h-4" stroke={2.1} />
                {unread > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center font-mono text-[9px] font-bold"
                    style={{ background: '#ef4444', color: '#fff', border: '1.5px solid var(--line)' }}
                  >
                    {Math.min(unread, 99)}
                  </span>
                )}
              </button>
              <div className="btl btl-sm sh-2 px-2 py-1 flex items-center gap-1" style={{ background: '#fde68a' }}>
                <span className="text-[12px] leading-none">🔥</span>
                <span className="font-mono font-bold text-[11px] tabular">{displayUser?.current_streak ?? 0}</span>
              </div>
              <Link to="/profile" className="w-9 h-9 btl btl-sm sh-2 overflow-hidden" style={{ background: 'var(--accent)' }}>
                <Avatar user={displayUser} size={36} className="w-full h-full" background="var(--accent)" textClassName="text-[16px]" />
              </Link>
            </div>
          </div>
        </header>

        <div className="overflow-hidden border-y-[2.5px] border-[var(--line)] py-1.5" style={{ background: 'var(--ink)', color: '#fff' }}>
          <div className="anim-marquee flex whitespace-nowrap font-mono font-bold text-[11px] uppercase tracking-widest">
            {[0, 1].map(block => (
              <div key={block} className="flex shrink-0">
                {[
                  `⚡ ${xp} XP UKUPNO`,
                  `🏆 #${rank} LJESTVICA`,
                  `⚔ IZAZOVI CEKAJU`,
                  `📅 DNEVNI KVIZ ${dailyDone ? 'RIJESEN' : 'SPREMAN'}`,
                ].map((message, index) => (
                  <span key={index} className="px-6 inline-flex items-center gap-2">
                    {message}
                    <span className="opacity-40">//</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar app-scroll-with-nav">
        <div style={{ height: `calc(${headerHeight}px + env(safe-area-inset-top))` }} />
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-baseline justify-between mb-1">
            <h1 className="font-display text-[26px] leading-none tracking-tight">Hej, {user.first_name}!</h1>
          </div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-widest opacity-60">// {xp} XP UKUPNO</div>
          <div className="mt-2 btl-sm btl" style={{ background: '#fff', padding: 2, height: 12, borderRadius: 999 }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (xp % 500) / 5)}%`,
                borderRadius: 999,
                background: 'var(--accent)',
                border: '1.5px solid var(--line)',
                minWidth: xp > 0 ? 8 : 0,
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={() => navigate('/daily')}
            className="btl btl-lg sh-6 w-full text-left p-5 relative overflow-hidden anim-pop"
            style={{ background: 'var(--accent)', color: 'var(--ink)' }}
          >
            <div className="absolute inset-0 grid-dots opacity-20" />
            <div className="relative">
              <div className="flex items-start justify-between mb-2">
                <span className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>DNEVNI KVIZ</span>
                <div className="font-mono text-[10px] font-bold opacity-70 tabular">Q#{String(day).padStart(3, '0')}</div>
              </div>
              <div className="font-display text-[40px] leading-[0.9] tracking-tight whitespace-pre-line mt-2">
                {'Dokazi svoje\nopce znanje'}
              </div>
              <div className="flex items-center gap-3 mt-4">
                <div className="btn btn-primary btn-sm" style={{ background: 'var(--ink)', color: '#fff', boxShadow: '3px 3px 0 0 var(--line)' }}>
                  <Icon name="play" className="w-3 h-3" stroke={0} />
                  {dailyDone ? 'Rijeseno' : 'Igraj'}
                </div>
                <div className="font-mono text-[11px] font-bold">+200 XP · 30 Q</div>
              </div>
            </div>
          </button>
        </div>

        <div className="px-4 pb-4">
          <button onClick={() => navigate(`/hot-topics/${HOT_TOPIC.id}`)} className="btl btl-lg sh-6 w-full text-left p-5 relative overflow-hidden hot-topic-card">
            <img src={HOT_TOPIC.image} alt="" className="hot-topic-image" />
            <div className="absolute inset-0 hot-topic-scrim" />
            <div className="relative max-w-[68%]">
              <div className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>HOT TEMA</div>
              <div className="font-display text-[38px] leading-[0.92] mt-2">{HOT_TOPIC.name}</div>
              <div className="flex items-center gap-3 mt-4">
                <div className="btn btn-primary btn-sm" style={{ background: 'var(--ink)', color: '#fff', boxShadow: '3px 3px 0 0 var(--line)' }}>
                  <Icon name="music" className="w-3 h-3" />
                  Igraj
                </div>
                <div className="font-mono text-[11px] font-bold">+{HOT_TOPIC.rewardXp} XP · {HOT_TOPIC.fallbackCount} Q</div>
              </div>
            </div>
          </button>
        </div>

        <div className="px-4 pb-3">
          <button onClick={() => navigate('/categories')} className="btl sh-4 p-4 relative overflow-hidden w-full text-left" style={{ background: '#fff' }}>
            <div className="absolute inset-0 grid-lines opacity-60" />
            <div className="relative flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">06 CAT.</div>
                <h2 className="font-display text-[24px] leading-none mt-1">Kvizovi po kategorijama</h2>
              </div>
              <div className="shrink-0 w-12 h-12 btl btl-sm grid place-items-center" style={{ background: 'var(--accent)', boxShadow: '2px 2px 0 0 var(--line)' }}>
                <Icon name="chev" className="w-6 h-6" stroke={2.4} />
              </div>
            </div>
          </button>
        </div>

        <div className="px-4 pb-4">
          <button onClick={() => navigate('/kvizopoli')} className="btl btl-lg sh-6 w-full text-left p-4 relative overflow-hidden kvizopoli-card">
            <div className="absolute inset-0 kvizopoli-grid" />
            <div className="relative flex gap-4 items-stretch">
              <div className="kvizopoli-board shrink-0" aria-hidden="true">
                <div className="kv-tile kv-tile-a" />
                <div className="kv-tile kv-tile-b" />
                <div className="kv-tile kv-tile-c" />
                <div className="kv-tile kv-tile-d" />
                <div className="kv-center">Q</div>
                <div className="kv-token kv-token-1" />
                <div className="kv-token kv-token-2" />
                <div className="kv-token kv-token-3" />
                <div className="kv-token kv-token-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>LIVE · 4 IGRACA</div>
                <h2 className="font-display text-[30px] leading-none mt-2">Kvizopoli</h2>
                <p className="font-mono text-[10.5px] font-bold uppercase leading-snug mt-2 opacity-75">
                  Baci kocku · sleti na temu · tocan odgovor osvaja polje.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="kvizopoli-dice">3</span>
                  <span className="font-mono text-[11px] font-bold">10 MIN · NAJVISE POSJEDA POBJEDUJE</span>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="px-4 pb-5 grid grid-cols-2 gap-3">
          <QuickCard icon="swords" label="Izazovi" sub="Igraj protiv prijatelja" onClick={() => navigate('/challenges')} />
          <QuickCard icon="chart" label="Ljestvica" sub="Vidi tko je prvi" onClick={() => navigate('/leaderboard')} />
        </div>

        <div className="px-4 pb-6">
          <div className="font-mono text-[10px] opacity-55 uppercase tracking-[0.3em] text-center">
            {CORE_CATEGORIES.map(category => `${questionCounts[category.id] || category.fallbackCount} ${category.name.toUpperCase()}`).slice(0, 3).join(' · ')}
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickCard({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: string
  label: string
  sub: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="btl sh-4 p-3 text-left relative" style={{ background: '#fff' }}>
      <div className="w-10 h-10 btl btl-sm grid place-items-center mb-2" style={{ background: 'var(--accent)', boxShadow: '2px 2px 0 0 var(--line)' }}>
        <Icon name={icon} className="w-5 h-5" stroke={2.3} />
      </div>
      <div className="font-display text-[14px] leading-tight">{label}</div>
      <div className="font-mono text-[10px] font-bold opacity-60 uppercase tracking-wider mt-0.5">{sub}</div>
    </button>
  )
}
