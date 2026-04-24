import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import Icon from '../components/Icon'
import { useWallet } from '../context/WalletContext'
import { useLoadingOverlay } from '../context/LoadingOverlayContext'

type Tab = 'powerups' | 'bundles' | 'gems'

export default function Shop() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { wallet, setWallet, refreshWallet } = useWallet()
  const [tab, setTab] = useState<Tab>(searchParams.get('gems_ok') ? 'gems' : 'powerups')
  const [catalog, setCatalog] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Handle Stripe success redirect
  useEffect(() => {
    if (!searchParams.get('gems_ok')) return
    setSuccessMsg('Dragulji uspješno kupljeni! 💎')
    setSearchParams({}, { replace: true })
    refreshWallet().catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          const packId = searchParams.get('pack')
          if (packId && nextCatalog?.gemPacks) {
            const pack = nextCatalog.gemPacks.find((p: any) => p.id === packId)
            if (pack) setSuccessMsg(`+${pack.gems + pack.bonus} dragulja dodano na tvoj račun! 💎`)
          }
        })
        .catch(err => setError(err.message || 'Greška pri učitavanju shopa'))
        .finally(() => setLoading(false))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useLoadingOverlay(loading, { message: 'OTVARAM SHOP' })

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
          <div className="flex items-center gap-1">
            <div className="btl btl-sm sh-2 px-2 py-1 flex items-center gap-1" style={{ background: '#fde68a' }}>
              <span className="text-[12px] leading-none">🪙</span>
              <span className="font-mono font-bold text-[11px] tabular">{wallet.coins}</span>
            </div>
            <div className="btl btl-sm sh-2 px-2 py-1 flex items-center gap-1" style={{ background: '#ddd6fe' }}>
              <span className="text-[12px] leading-none">💎</span>
              <span className="font-mono font-bold text-[11px] tabular">{wallet.gems}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar max-w-xl mx-auto w-full px-4 py-4 app-scroll-with-nav">
        <div className="btl sh-3 p-1 flex gap-1 mb-4" style={{ background: '#fff' }}>
          {[
            { key: 'powerups', label: 'Powerups' },
            { key: 'bundles', label: 'Paketi' },
            { key: 'gems', label: 'Gems' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as Tab)}
              className={`flex-1 py-2 font-mono text-[10.5px] font-bold uppercase tracking-widest rounded-[10px] ${tab === item.key ? '' : 'opacity-50'}`}
              style={tab === item.key ? { background: 'var(--ink)', color: '#fff', border: '1.5px solid var(--line)' } : {}}
            >
              {item.label}
            </button>
          ))}
        </div>

        {successMsg && (
          <div className="btl p-3 mb-4 font-mono text-[11px] font-bold" style={{ background: '#bbf7d0', borderColor: '#16a34a' }}>
            {successMsg}
          </div>
        )}

        {error && (
          <div className="btl p-3 mb-4 font-mono text-[11px] font-bold" style={{ background: '#fecaca', borderColor: '#dc2626' }}>
            {error}
          </div>
        )}

        {tab === 'powerups' && (
          <div className="flex flex-col gap-2.5">
            {catalog.powerups.map((powerup: any) => (
              <div key={powerup.id} className="btl sh-3 p-3" style={{ background: '#fff' }}>
                <div className="flex items-center gap-3">
                  <div className="btl btl-sm w-14 h-14 grid place-items-center text-[32px] shrink-0" style={{ background: 'var(--paper)', borderWidth: 2 }}>
                    {powerup.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-display text-[15px] leading-tight">{powerup.name}</div>
                      <span className="chip" style={{ background: '#fde68a', fontSize: 9, padding: '2px 5px', borderWidth: 1.5, boxShadow: '1.5px 1.5px 0 0 var(--line)' }}>
                        ×{wallet.inv?.[powerup.id] || 0}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] opacity-70 mt-0.5">{powerup.description}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    disabled={busyKey === `${powerup.id}:coins`}
                    onClick={() => buyPowerup(powerup.id, 'coins')}
                    className="btl btl-sm py-2 flex items-center justify-center gap-1"
                    style={{ background: '#fde68a', borderWidth: 2, boxShadow: '2px 2px 0 0 var(--line)' }}
                  >
                    <span className="text-[14px] leading-none">🪙</span>
                    <span className="font-mono text-[11px] font-bold tabular">{powerup.coins}</span>
                  </button>
                  <button
                    disabled={busyKey === `${powerup.id}:gems`}
                    onClick={() => buyPowerup(powerup.id, 'gems')}
                    className="btl btl-sm py-2 flex items-center justify-center gap-1"
                    style={{ background: '#ddd6fe', borderWidth: 2, boxShadow: '2px 2px 0 0 var(--line)' }}
                  >
                    <span className="text-[14px] leading-none">💎</span>
                    <span className="font-mono text-[11px] font-bold tabular">{powerup.gems}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'bundles' && (
          <div className="flex flex-col gap-3">
            {catalog.bundles.map((bundle: any) => {
              const isMega = bundle.id === 'mega'
              return (
                <div
                  key={bundle.id}
                  className="btl sh-4 p-4 relative overflow-hidden"
                  style={{ background: isMega ? 'var(--ink)' : '#fff', color: isMega ? '#fff' : 'var(--ink)' }}
                >
                  {isMega && (
                    <div className="absolute top-3 right-3 chip" style={{ background: 'var(--accent)', fontSize: 9, padding: '2px 6px', borderWidth: 1.5 }}>
                      🔥 HOT
                    </div>
                  )}
                  <div className="flex items-baseline gap-2 mb-2">
                    <div className="font-display text-[20px] leading-none">{bundle.name}</div>
                    <div className="chip" style={{ background: '#fecaca', fontSize: 9, padding: '2px 6px', borderWidth: 1.5, color: 'var(--ink)' }}>
                      -{bundle.off_pct}%
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {Object.entries(bundle.items).map(([powerupId, qty]) => {
                      const p = catalog.powerups.find((pp: any) => pp.id === powerupId)
                      return (
                        <div
                          key={powerupId}
                          className="btl btl-sm px-2 py-1 flex items-center gap-1"
                          style={{ background: isMega ? 'rgba(255,255,255,0.12)' : 'var(--paper)', borderWidth: 1.5 }}
                        >
                          <span className="text-[14px] leading-none">{p?.emoji}</span>
                          <span className="font-mono text-[10.5px] font-bold tabular">×{String(qty)}</span>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    disabled={busyKey === bundle.id}
                    onClick={() => buyBundle(bundle.id)}
                    className="w-full btl btl-sm py-2.5 flex items-center justify-center gap-2"
                    style={{ background: 'var(--accent)', color: 'var(--ink)', borderWidth: 2, boxShadow: '3px 3px 0 0 var(--line)' }}
                  >
                    <span className="text-[14px] leading-none">💎</span>
                    <span className="font-display text-[14px] tabular">{bundle.cost_gems}</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-70">· KUPI</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'gems' && (
          <>
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2 px-1">// KUPI 💎</div>
            <div className="grid grid-cols-2 gap-2.5">
              {catalog.gemPacks.map((pack: any) => (
                <div key={pack.id} className="btl sh-3 p-3 relative" style={{ background: '#fff' }}>
                  {pack.popular && (
                    <div className="absolute -top-2 -right-2 chip" style={{ background: 'var(--accent)', fontSize: 9, padding: '2px 6px', borderWidth: 1.5, boxShadow: '2px 2px 0 0 var(--line)' }}>
                      POP.
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-[40px] leading-none mb-1">💎</div>
                    <div className="font-display text-[22px] leading-none tabular">{pack.gems + pack.bonus}</div>
                    {pack.bonus > 0 && (
                      <div className="font-mono text-[9.5px] font-bold mt-0.5" style={{ color: '#16a34a' }}>
                        +{pack.bonus} BONUS
                      </div>
                    )}
                    <button
                      disabled={busyKey === pack.id}
                      onClick={() => buyGems(pack.id)}
                      className="btn btn-primary w-full mt-3"
                    >
                      €{Number(pack.price_eur).toFixed(2)}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="font-mono text-[10px] text-center opacity-50 mt-4">
              💎 se koristi za powerupe i premium pakete
            </div>
          </>
        )}
      </div>
    </div>
  )
}
