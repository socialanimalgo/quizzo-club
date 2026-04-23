import { Link, useLocation, useNavigate } from 'react-router-dom'

function HomeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function ChartIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function SwordsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="21" x2="9" y2="19"/><line x1="3" y1="19" x2="5" y2="21"/></svg>
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}

const ITEMS = [
  { id: 'home',        path: '/',            label: 'POČETNA',   Icon: HomeIcon },
  { id: 'leaderboard', path: '/leaderboard', label: 'STATISTIKA', Icon: ChartIcon },
  { id: 'challenges',  path: '/challenges',  label: 'VS',         Icon: SwordsIcon },
  { id: 'profile',     path: '/profile',     label: 'PROFIL',     Icon: UserIcon },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="shrink-0 px-2 pt-2 pb-5 relative" style={{ background: 'var(--paper)', borderTop: '2.5px solid var(--line)' }}>
      <div className="flex items-end justify-between">
        {ITEMS.slice(0, 2).map(it => {
          const active = location.pathname === it.path
          return (
            <Link key={it.id} to={it.path} className="flex flex-col items-center gap-0.5 flex-1 py-1">
              <div className={active ? '' : 'opacity-40'}><it.Icon /></div>
              <span className={`font-mono text-[9px] font-bold uppercase tracking-wider ${active ? '' : 'opacity-40'}`}>{it.label}</span>
              {active && <div className="h-[3px] w-6 rounded-full mt-0.5" style={{ background: 'var(--accent)' }} />}
            </Link>
          )
        })}

        {/* Central play button */}
        <button onClick={() => navigate('/daily')}
          className="relative -mt-6 w-14 h-14 btl flex items-center justify-center"
          style={{ background: 'var(--ink)', color: '#fff', borderRadius: 999, borderWidth: 3, boxShadow: '4px 4px 0 0 var(--accent)', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-0.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>

        {ITEMS.slice(2).map(it => {
          const active = location.pathname === it.path
          return (
            <Link key={it.id} to={it.path} className="flex flex-col items-center gap-0.5 flex-1 py-1">
              <div className={active ? '' : 'opacity-40'}><it.Icon /></div>
              <span className={`font-mono text-[9px] font-bold uppercase tracking-wider ${active ? '' : 'opacity-40'}`}>{it.label}</span>
              {active && <div className="h-[3px] w-6 rounded-full mt-0.5" style={{ background: 'var(--accent)' }} />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
