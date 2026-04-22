import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { strings, getLangFromCountry, langMeta, type Lang } from '../lib/subscribe-i18n'

// ── Check icon ───────────────────────────────────────────────────
function Check() {
  return (
    <svg className="w-4 h-4 shrink-0 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Plan card ────────────────────────────────────────────────────
interface PlanCardProps {
  name: string
  price: string
  period: string
  then: string
  trialBadge: string
  features: string[]
  cta: string
  highlighted?: boolean
  bestValue?: string
  save?: string
  onSelect: () => void
  loading: boolean
  disabled: boolean
}

function PlanCard({ name, price, period, then, trialBadge, features, cta, highlighted, bestValue, save, onSelect, loading, disabled }: PlanCardProps) {
  return (
    <div className={`relative flex flex-col rounded-3xl p-6 sm:p-7 transition-all duration-200 ${
      highlighted
        ? 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-purple-700 text-white shadow-2xl shadow-indigo-500/30 ring-0 scale-[1.02]'
        : 'bg-white text-gray-900 shadow-lg ring-1 ring-gray-100'
    }`}>
      {/* Badges */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`text-sm font-bold tracking-wide uppercase ${highlighted ? 'text-indigo-200' : 'text-gray-400'}`}>
          {name}
        </span>
        {save && (
          <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">
            {save}
          </span>
        )}
        {bestValue && (
          <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            {bestValue}
          </span>
        )}
      </div>

      {/* Trial badge */}
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold mb-4 w-fit ${
        highlighted ? 'bg-white/15 text-white' : 'bg-indigo-50 text-indigo-700'
      }`}>
        <span>🎁</span> {trialBadge}
      </div>

      {/* Price */}
      <div className="mb-1">
        <span className={`text-5xl font-black tracking-tight ${highlighted ? 'text-white' : 'text-gray-900'}`}>
          €{highlighted ? '9.99' : '2.99'}
        </span>
        <span className={`text-base font-medium ml-1 ${highlighted ? 'text-indigo-200' : 'text-gray-400'}`}>
          {period}
        </span>
      </div>
      <p className={`text-sm mb-6 ${highlighted ? 'text-indigo-300' : 'text-gray-400'}`}>
        {then}
      </p>

      {/* Features */}
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            {highlighted
              ? <svg className="w-4 h-4 shrink-0 text-indigo-300 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              : <Check />
            }
            <span className={highlighted ? 'text-indigo-100' : 'text-gray-600'}>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={onSelect}
        disabled={loading || disabled}
        className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${
          highlighted
            ? 'bg-white text-indigo-700 hover:bg-indigo-50 shadow-lg shadow-indigo-900/20'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/25'
        }`}
      >
        {loading ? '…' : cta}
      </button>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────
export default function Subscribe() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const success = searchParams.get('success') === 'true'

  const [lang, setLang] = useState<Lang>('en')
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'yearly' | null>(null)
  const [user, setUser] = useState<any>(null)
  const [subStatus, setSubStatus] = useState<string | null>(null)
  const [detectingLocale, setDetectingLocale] = useState(true)

  const s = strings[lang]

  useEffect(() => {
    // Detect geo locale
    fetch('/api/locale')
      .then(r => r.json())
      .then(({ countryCode }) => setLang(getLangFromCountry(countryCode)))
      .catch(() => {})
      .finally(() => setDetectingLocale(false))

    // Load user + subscription
    api.auth.getUser().then(u => {
      setUser(u)
      if (u) {
        api.subscription.get().then(sub => setSubStatus(sub?.status ?? null)).catch(() => {})
      }
    })
  }, [])

  async function handleSelect(plan: 'monthly' | 'yearly') {
    if (!user) {
      navigate('/signup')
      return
    }
    setLoadingPlan(plan)
    try {
      const { url } = await api.subscription.createCheckout(plan)
      window.location.href = url
    } catch (err: any) {
      alert(err.message || 'Something went wrong')
      setLoadingPlan(null)
    }
  }

  async function handlePortal() {
    try {
      const { url } = await api.subscription.getPortal()
      window.location.href = url
    } catch (err: any) {
      alert(err.message || 'Something went wrong')
    }
  }

  // ── Success screen ─────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-3xl shadow-xl p-10">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-black text-gray-900 mb-3">{s.successTitle}</h1>
            <p className="text-gray-500 mb-8 leading-relaxed">{s.successSub}</p>
            <a
              href="/"
              className="inline-block w-full bg-indigo-600 text-white font-bold py-3.5 rounded-2xl hover:bg-indigo-700 transition-colors"
            >
              {s.backToApp}
            </a>
          </div>
        </div>
      </div>
    )
  }

  const isSubscribed = subStatus === 'active' || subStatus === 'trialing'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-indigo-950/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/lingee-eyes-open.png" alt="Lingee" className="h-8" />
            <span className="font-bold text-white text-lg hidden sm:block">Lingee</span>
          </a>

          {/* Language picker */}
          {!detectingLocale && (
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {(Object.keys(langMeta) as Lang[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    lang === l
                      ? 'bg-white text-indigo-900'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {langMeta[l].flag} <span className="hidden sm:inline">{langMeta[l].label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="text-center px-4 pt-14 pb-10 sm:pt-20 sm:pb-14">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/90 text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            🎁 {s.trialBadge} — {s.cancel.split('.')[0]}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight mb-4">
            {s.headline}
          </h1>
          <p className="text-indigo-200 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
            {s.sub}
          </p>
        </div>
      </section>

      {/* Already subscribed */}
      {isSubscribed && (
        <div className="max-w-lg mx-auto px-4 mb-6">
          <div className="bg-green-500/20 border border-green-400/30 rounded-2xl p-4 text-center">
            <p className="text-green-300 font-medium mb-3">{s.alreadySubbed}</p>
            <button
              onClick={handlePortal}
              className="bg-white text-green-800 font-semibold text-sm px-5 py-2 rounded-xl hover:bg-green-50 transition-colors"
            >
              {s.manageBtn}
            </button>
          </div>
        </div>
      )}

      {/* Not logged in notice */}
      {!user && (
        <div className="max-w-lg mx-auto px-4 mb-6 text-center">
          <p className="text-indigo-300 text-sm">{s.notLoggedIn}</p>
        </div>
      )}

      {/* Pricing cards */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-start">
          {/* Monthly */}
          <PlanCard
            name={s.monthlyName}
            price="2.99"
            period={s.perMonth}
            then={s.thenMonthly}
            trialBadge={s.trialBadge}
            features={s.features}
            cta={user ? s.cta : s.signUpCta}
            highlighted={false}
            onSelect={() => handleSelect('monthly')}
            loading={loadingPlan === 'monthly'}
            disabled={isSubscribed || loadingPlan === 'yearly'}
          />
          {/* Yearly */}
          <PlanCard
            name={s.yearlyName}
            price="9.99"
            period={s.perYear}
            then={s.thenYearly}
            trialBadge={s.trialBadge}
            features={s.features}
            cta={user ? s.cta : s.signUpCta}
            highlighted={true}
            bestValue={s.bestValue}
            save={s.save}
            onSelect={() => handleSelect('yearly')}
            loading={loadingPlan === 'yearly'}
            disabled={isSubscribed || loadingPlan === 'monthly'}
          />
        </div>

        {/* Cancel note */}
        <p className="text-center text-indigo-300/70 text-xs sm:text-sm mt-6 leading-relaxed">
          🔒 {s.cancel}
        </p>
      </section>

      {/* Feature comparison table — desktop only */}
      <section className="hidden md:block max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-white/5 backdrop-blur rounded-3xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-3 text-sm">
            <div className="p-4 font-semibold text-white/50 border-b border-white/10">Feature</div>
            <div className="p-4 font-semibold text-white/70 border-b border-white/10 text-center">Free</div>
            <div className="p-4 font-semibold text-indigo-300 border-b border-white/10 text-center">Pro ✨</div>
            {[
              ['Hearts / day', '3', '∞'],
              ['Lessons per category', '2', '∞'],
              ['Certificates', '—', '✓'],
              ['Job applications', '—', '∞'],
              ['Support', 'Standard', 'Priority'],
            ].map(([feat, free, pro], i) => (
              <>
                <div key={`f${i}`} className={`p-4 text-white/60 ${i < 4 ? 'border-b border-white/5' : ''}`}>{feat}</div>
                <div key={`fr${i}`} className={`p-4 text-center text-white/40 ${i < 4 ? 'border-b border-white/5' : ''}`}>{free}</div>
                <div key={`pr${i}`} className={`p-4 text-center text-indigo-300 font-medium ${i < 4 ? 'border-b border-white/5' : ''}`}>{pro}</div>
              </>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 px-4 text-center">
        <div className="flex items-center justify-center gap-4 text-xs text-indigo-400/60">
          <a href="/" className="hover:text-indigo-300">{strings.en.backToApp}</a>
          <span>·</span>
          <span>© {new Date().getFullYear()} Lingee</span>
        </div>
      </footer>
    </div>
  )
}
