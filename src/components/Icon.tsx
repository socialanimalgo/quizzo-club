type IconProps = {
  name: string
  className?: string
  stroke?: number
}

export default function Icon({ name, className = 'w-5 h-5', stroke = 2.3 }: IconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
    className,
  }

  switch (name) {
    case 'globe':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
    case 'scroll':
      return <svg {...common}><path d="M6 3h11a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6" /><path d="M5 6a2 2 0 0 1-2-2" /><path d="M9 8h7M9 12h7M9 16h4" /></svg>
    case 'trophy':
      return <svg {...common}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>
    case 'atom':
      return <svg {...common}><circle cx="12" cy="12" r="1.5" /><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" /></svg>
    case 'music':
      return <svg {...common}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
    case 'mask':
      return <svg {...common}><path d="M3 7c0-1 1-2 2-2h14c1 0 2 1 2 2v3c0 5-4 10-9 10S3 15 3 10V7z" /><circle cx="9" cy="11" r="1.5" /><circle cx="15" cy="11" r="1.5" /></svg>
    case 'mail':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
    case 'globe-alt':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
    case 'crown':
      return <svg {...common}><path d="M3 18h18l-2-11-5 4-3-6-3 6-5-4L3 18z" /></svg>
    case 'back':
      return <svg {...common}><path d="M15 6l-6 6 6 6M9 12h11" /></svg>
    case 'chev':
      return <svg {...common}><path d="M9 6l6 6-6 6" /></svg>
    case 'swords':
      return <svg {...common}><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M15 5l4-4M12 8l7-7h2v2l-7 7" /></svg>
    case 'target':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
    case 'chart':
      return <svg {...common}><path d="M3 20h18M6 16V9M11 16V5M16 16v-6M21 16v-3" /></svg>
    case 'home':
      return <svg {...common}><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z" /></svg>
    case 'play':
      return <svg {...common}><path d="M6 4l14 8-14 8V4z" fill="currentColor" /></svg>
    case 'flame':
      return <svg {...common}><path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-4 1-6 1-9z" /></svg>
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></svg>
    case 'x':
      return <svg {...common}><path d="M18 6 6 18M6 6l12 12" /></svg>
    case 'check':
      return <svg {...common}><path d="m5 12 5 5L19 8" /></svg>
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
    case 'bag':
      return <svg {...common}><path d="M6 8h12l-1 11H7L6 8z" /><path d="M9 8V7a3 3 0 0 1 6 0v1" /></svg>
    case 'mic':
      return <svg {...common}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6" /></svg>
    case 'star':
      return <svg {...common}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
    case 'briefcase':
      return <svg {...common}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v.01M8 12h8" /></svg>
    case 'coffee':
      return <svg {...common}><path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8zM6 2v3M10 2v3M14 2v3" /></svg>
    case 'sword':
      return <svg {...common}><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l2-2M15 5l4-4h2v2l-4 4M3 21l4-4" /></svg>
    case 'wand':
      return <svg {...common}><path d="m15 4-1 1M4 15l-1 1M9 4l.5 1.5M4 9l1.5.5M20 9l-1.5.5M15 20l-.5-1.5M9 20l.5-1.5M20 15l-1.5-.5M12 12 3 21" /><path d="m12 12 4-9 1 4 4 1-9 4z" /></svg>
    default:
      return null
  }
}
