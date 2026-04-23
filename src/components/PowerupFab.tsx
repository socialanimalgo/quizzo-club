import { useMemo, useState } from 'react'
import { useWallet } from '../context/WalletContext'

const POWERUPS = [
  { id: 'fifty', emoji: '✂️', name: '50:50' },
  { id: 'freeze', emoji: '❄️', name: 'Freeze' },
  { id: 'doublexp', emoji: '⚡', name: '2× XP' },
  { id: 'reveal', emoji: '🔍', name: 'Reveal' },
]

export default function PowerupFab({ disabled, onUse }: { disabled?: boolean; onUse: (powerupId: string) => void }) {
  const { wallet } = useWallet()
  const [open, setOpen] = useState(false)
  const total = useMemo(() => Object.values(wallet.inv || {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0), [wallet.inv])

  return (
    <div className="fixed right-4 bottom-[calc(108px+env(safe-area-inset-bottom))] z-30">
      {open && (
        <div className="mb-3 btl sh-4 p-2.5 w-[220px]" style={{ background: '#fff' }}>
          <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2 px-1">// Powerups</div>
          <div className="flex flex-col gap-2">
            {POWERUPS.map(powerup => {
              const qty = wallet.inv?.[powerup.id] || 0
              const unavailable = qty < 1 || disabled
              return (
                <button
                  key={powerup.id}
                  onClick={() => {
                    if (unavailable) return
                    onUse(powerup.id)
                    setOpen(false)
                  }}
                  className="btl btl-sm px-3 py-2 flex items-center gap-3 text-left"
                  style={{ background: unavailable ? '#f3f4f6' : '#fff', opacity: unavailable ? 0.45 : 1, boxShadow: '2px 2px 0 0 var(--line)' }}
                >
                  <span className="w-9 h-9 btl btl-sm grid place-items-center">{powerup.emoji}</span>
                  <div className="flex-1 font-display text-[14px]">{powerup.name}</div>
                  <span className="chip">×{qty}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <button
        onClick={() => !disabled && setOpen(value => !value)}
        className="relative w-14 h-14 btl grid place-items-center"
        style={{ background: disabled ? '#d1d5db' : 'var(--accent)', boxShadow: '5px 5px 0 0 var(--line)', borderRadius: 999 }}
      >
        <span className="font-display text-[24px]">⚡</span>
        {total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full grid place-items-center font-mono text-[10px] font-bold" style={{ background: '#fff', border: '2px solid var(--line)' }}>
            {total}
          </span>
        )}
      </button>
    </div>
  )
}
