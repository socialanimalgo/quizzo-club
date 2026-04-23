import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import Icon from '../components/Icon'
import { useWallet } from '../context/WalletContext'

type Tab = 'powerups' | 'bundles' | 'gems'

export default function Shop() {
  const navigate = useNavigate()
  const { wallet, setWallet, refreshWallet } = useWallet()
  const [tab, setTab] = useState<Tab>('powerups')
  const [catalog, setCatalog] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.auth.getUser().then(user => {
      if (!user) {
        navigate('/signin')
        return
      }
      Promise.all([api.shop.catalog(), api.shop.wallet()])
        .then(([nextCatalog, nextWallet]) => {
          setCatalog(nextCatalog)
          setWallet(nextWallet)
        })
        .catch(err => setError(err.message || 'Greška pri učitavanju shopa'))
        .finally(() => setLoading(false))
    })
  }, [navigate, setWallet])

  const totalOwned = useMemo(
    () => Object.values(wallet.inv || {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0),
    [wallet.inv]
  )

  async function buyPowerup(powerupId: string, currency: 'coins' | 'gems') {
    setBusyKey(`${powerupId}:${currency}`)
    setError('')
    try {
      const result = await api.shop.buyPowerup({ powerup_id: powerupId, currency })
      setWallet(result.wallet)
    } catch (err: any) {
      setError(err.message || 'Kupnja nije uspjela')
    } finally {
      setBusyKey('')
    }
  }

  async function buyBundle(bundleId: string) {
    setBusyKey(bundleId)
    setError('')
    try {
      const result = await api.shop.buyBundle(bundleId)
      setWallet(result.wallet)
    } catch (err: any) {
      setError(err.message || 'Kupnja paketa nije uspjela')
    } finally {
      setBusyKey('')
    }
  }

  async function buyGems(packId: string) {
    setBusyKey(packId)
    setError('')
    try {
      const result = await api.shop.buyGems(packId)
      if (result.url) window.location.href = result.url
      else if (result.checkout_url) window.location.href = result.checkout_url
      else throw new Error('Gem kupnja još nije dostupna')
    } catch (err: any) {
      setError(err.message || 'Gem kupnja nije dostupna')
      await refreshWallet().catch(() => {})
    } finally {
      setBusyKey('')
    }
  }

  if (loading) return null
  if (!catalog) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="font-mono text-[11px] font-bold uppercase tracking-widest opacity-60">{error || 'Shop nije dostupan'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <header className="px-4 pt-4 pb-3 border-b-[2.5px] sticky top-0 z-10" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btl btl-sm sh-2 w-9 h-9 grid place-items-center" style={{ background: '#fff' }}>
            <Icon name="back" className="w-4 h-4" stroke={2.2} />
          </button>
          <div className="flex-1">
            <div className="font-display text-[22px] leading-none">Shop</div>
            <div className="font-mono text-[10px] opacity-60 mt-0.5">{totalOwned} powerupa ukupno</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="btl btl-sm sh-2 px-2 py-1 flex items-center gap-1.5" style={{ background: '#fff' }}>
              <span className="font-mono text-[11px]">🪙</span>
              <span className="font-mono font-bold text-[12px] tabular">{wallet.coins}</span>
            </div>
            <div className="btl btl-sm sh-2 px-2 py-1 flex items-center gap-1.5" style={{ background: '#fff' }}>
              <span className="font-mono text-[11px]">💎</span>
              <span className="font-mono font-bold text-[12px] tabular">{wallet.gems}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar max-w-xl mx-auto w-full px-4 py-4 app-scroll-with-nav">
        <div className="btl sh-3 p-1 flex gap-1 mb-4" style={{ background: '#fff' }}>
          {[
            { key: 'powerups', label: 'Powerups' },
            { key: 'bundles', label: 'Bundles' },
            { key: 'gems', label: 'Gems' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as Tab)}
              className={`flex-1 py-2 font-mono text-[10px] font-bold uppercase tracking-widest rounded-[10px] ${tab === item.key ? '' : 'opacity-50'}`}
              style={tab === item.key ? { background: 'var(--ink)', color: '#fff', border: '1.5px solid var(--line)' } : {}}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="btl p-3 mb-4 font-mono text-[11px] font-bold" style={{ background: '#fecaca', borderColor: '#dc2626' }}>
            {error}
          </div>
        )}

        {tab === 'powerups' && (
          <div className="grid grid-cols-1 gap-3">
            {catalog.powerups.map((powerup: any) => (
              <div key={powerup.id} className="btl sh-4 p-4" style={{ background: '#fff' }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 btl btl-sm grid place-items-center font-display text-[20px]" style={{ background: 'var(--accent-soft)' }}>
                    {powerup.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-display text-[17px]">{powerup.name}</div>
                      <span className="chip">×{wallet.inv?.[powerup.id] || 0}</span>
                    </div>
                    <div className="font-mono text-[10px] opacity-60 mt-1">{powerup.description}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={busyKey === `${powerup.id}:coins`} onClick={() => buyPowerup(powerup.id, 'coins')} className="btn">
                    🪙 {powerup.coins}
                  </button>
                  <button disabled={busyKey === `${powerup.id}:gems`} onClick={() => buyPowerup(powerup.id, 'gems')} className="btn btn-primary">
                    💎 {powerup.gems}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'bundles' && (
          <div className="grid grid-cols-1 gap-3">
            {catalog.bundles.map((bundle: any) => (
              <div key={bundle.id} className="btl sh-4 p-4" style={{ background: bundle.id === 'mega' ? 'var(--ink)' : '#fff', color: bundle.id === 'mega' ? '#fff' : 'var(--ink)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-display text-[18px]">{bundle.name}</div>
                    <div className="font-mono text-[10px] opacity-60 mt-1">{bundle.off_pct}% OFF</div>
                  </div>
                  {bundle.id === 'mega' && <span className="chip" style={{ background: 'var(--accent)', color: 'var(--ink)' }}>HOT</span>}
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(bundle.items).map(([powerupId, qty]) => (
                    <span key={powerupId} className="chip" style={{ background: bundle.id === 'mega' ? '#fff' : 'var(--paper)' }}>
                      {powerupId} ×{String(qty)}
                    </span>
                  ))}
                </div>
                <button disabled={busyKey === bundle.id} onClick={() => buyBundle(bundle.id)} className={`btn w-full ${bundle.id === 'mega' ? '' : 'btn-primary'}`} style={bundle.id === 'mega' ? { background: 'var(--accent)', color: 'var(--ink)' } : {}}>
                  Kupi za 💎 {bundle.cost_gems}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'gems' && (
          <div className="grid grid-cols-1 gap-3">
            {catalog.gemPacks.map((pack: any) => (
              <div key={pack.id} className="btl sh-4 p-4" style={{ background: '#fff' }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-display text-[18px]">💎 {pack.gems + pack.bonus}</div>
                    <div className="font-mono text-[10px] opacity-60 mt-1">
                      {pack.gems} baza{pack.bonus ? ` + ${pack.bonus} bonus` : ''}
                    </div>
                  </div>
                  {pack.popular && <span className="chip">POPULAR</span>}
                </div>
                <button disabled={busyKey === pack.id} onClick={() => buyGems(pack.id)} className="btn btn-primary w-full">
                  €{Number(pack.price_eur).toFixed(2)}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
