import Icon from './Icon'

type GameInvitePopupProps = {
  invite: {
    id: string
    type: 'kvizopoli' | 'vs'
    fromDisplayName: string
    roomCode?: string
    currentPlayers?: number
    maxPlayers?: number
    createdAt?: string
  } | null
  busy?: boolean
  error?: string
  onAccept: () => void
  onDismiss: () => void
}

export default function GameInvitePopup({ invite, busy = false, error = '', onAccept, onDismiss }: GameInvitePopupProps) {
  if (!invite) return null

  const isKvizopoli = invite.type === 'kvizopoli'
  const chipLabel = isKvizopoli ? 'KVIZOPOLI' : 'VS IZAZOV'
  const meta = isKvizopoli
    ? [invite.roomCode ? `Soba ${invite.roomCode}` : null, invite.currentPlayers && invite.maxPlayers ? `${invite.currentPlayers}/${invite.maxPlayers} igrača` : null].filter(Boolean).join(' · ')
    : 'Prihvati izazov odmah'

  return (
    <div className="fixed inset-x-0 bottom-[calc(124px+env(safe-area-inset-bottom))] z-[52] px-4 pointer-events-none">
      <div className="max-w-xl mx-auto">
        <div className="btl btl-lg sh-ink-acc p-4 pointer-events-auto" style={{ background: 'var(--paper)' }}>
          <div className="flex items-start gap-3">
            <div className="btl btl-sm w-12 h-12 grid place-items-center shrink-0" style={{ background: isKvizopoli ? '#baf2d8' : '#a5f3fc', borderWidth: 2 }}>
              <Icon name={isKvizopoli ? 'target' : 'swords'} className="w-5 h-5" stroke={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>{chipLabel}</div>
                  <div className="font-display text-[20px] leading-tight mt-2">{invite.fromDisplayName} te poziva</div>
                  <div className="font-mono text-[10px] opacity-60 uppercase tracking-widest mt-1">{meta}</div>
                </div>
                <button onClick={onDismiss} className="btl btl-sm w-9 h-9 grid place-items-center shrink-0" style={{ background: '#fff', borderWidth: 2 }}>
                  <Icon name="x" className="w-4 h-4" stroke={2.2} />
                </button>
              </div>
              {error && <div className="font-mono text-[10px] mt-2" style={{ color: '#dc2626' }}>{error}</div>}
              <div className="flex gap-2 mt-3">
                <button onClick={onAccept} disabled={busy} className="btn btn-primary btn-sm flex-1">
                  {busy ? '…' : 'Prihvati'}
                </button>
                <button onClick={onDismiss} disabled={busy} className="btn btn-sm flex-1">
                  Kasnije
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
