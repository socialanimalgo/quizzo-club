import { useNavigate } from 'react-router-dom'
import QuizzoLogo from './QuizzoLogo'
import Icon from './Icon'
import Avatar from './Avatar'
import { useWallet } from '../context/WalletContext'
import { useNotificationSummary } from '../hooks/useNotificationSummary'

export default function AppHeader() {
  const navigate = useNavigate()
  const { wallet, user } = useWallet()
  const { unread } = useNotificationSummary()

  const totalPowerups = Object.values(wallet.inv || {}).reduce((s: number, v: any) => s + Number(v || 0), 0)
  const streak = user?.current_streak ?? 0

  return (
    <header
      className="px-4 pt-4 pb-3 border-b-[2.5px] sticky top-0 z-10"
      style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}
    >
      <div className="max-w-xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <QuizzoLogo size={34} />
          <div className="leading-tight">
            <div className="font-display text-[18px] font-bold leading-none">
              Quizzo<span style={{ color: 'var(--accent-deep)' }}>.</span>
            </div>
            <div className="font-mono text-[9px] font-bold opacity-50 uppercase tracking-[0.2em] mt-0.5">CLUB · v1</div>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {/* Coins */}
          <button
            onClick={() => navigate('/shop')}
            className="btl btl-sm sh-2 px-2 py-1 flex items-center gap-1"
            style={{ background: '#fde68a' }}
          >
            <span className="text-[12px] leading-none">🪙</span>
            <span className="font-mono font-bold text-[11px] tabular">{wallet.coins}</span>
          </button>

          {/* Gems */}
          <button
            onClick={() => navigate('/shop')}
            className="btl btl-sm sh-2 px-2 py-1 flex items-center gap-1"
            style={{ background: '#ddd6fe' }}
          >
            <span className="text-[12px] leading-none">💎</span>
            <span className="font-mono font-bold text-[11px] tabular">{wallet.gems}</span>
          </button>

          {/* Shop bag */}
          <button
            onClick={() => navigate('/shop')}
            className="relative w-9 h-9 btl btl-sm sh-2 grid place-items-center"
            style={{ background: '#fff' }}
          >
            <Icon name="bag" className="w-4 h-4" stroke={2.1} />
            {totalPowerups > 0 && (
              <span
                className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
                style={{ background: '#3b82f6', border: '1.5px solid var(--paper)' }}
              />
            )}
          </button>

          {/* Bell */}
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

          {/* Streak */}
          <div
            className="btl btl-sm sh-2 px-2 py-1 flex items-center gap-1"
            style={{ background: '#fde68a' }}
          >
            <span className="text-[12px] leading-none">🔥</span>
            <span className="font-mono font-bold text-[11px] tabular">{streak}</span>
          </div>

          {/* Avatar */}
          <button
            onClick={() => navigate('/profile')}
            className="w-9 h-9 btl btl-sm sh-2 overflow-hidden"
            style={{ background: 'var(--accent)' }}
          >
            <Avatar user={user} size={36} background="var(--accent)" className="w-full h-full" textClassName="text-[16px]" />
          </button>
        </div>
      </div>
    </header>
  )
}
