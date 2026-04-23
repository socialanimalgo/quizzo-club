type QuizzoLogoProps = {
  size?: number
  withText?: boolean
  color?: string
  spin?: boolean
  className?: string
}

export default function QuizzoLogo({
  size = 48,
  withText = false,
  color = 'var(--accent)',
  spin = false,
  className = '',
}: QuizzoLogoProps) {
  const stroke = Math.max(3, size * 0.09)

  return (
    <div className={`inline-flex items-center ${className}`} style={{ gap: size * 0.28 }}>
      <div style={{ width: size, height: size, position: 'relative' }}>
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          style={{
            animation: spin ? 'logoSpin 6s cubic-bezier(.65,.05,.36,1) infinite' : 'none',
            overflow: 'visible',
          }}
        >
          <rect x="6" y="8" width="48" height="48" rx="12" fill="var(--line)" />
          <rect x="2" y="4" width="48" height="48" rx="12" fill={color} stroke="var(--line)" strokeWidth={stroke * 0.7} />
          <circle cx="26" cy="28" r="11" fill="var(--paper)" stroke="var(--line)" strokeWidth={stroke * 0.6} />
          <path d="M32 34 L44 46" stroke="var(--line)" strokeWidth={stroke} strokeLinecap="round" />
          <circle
            cx="26"
            cy="26"
            r="3"
            fill="var(--line)"
            style={{ transformOrigin: '26px 26px', animation: 'logoBlink 3.5s ease-in-out infinite' }}
          />
        </svg>
      </div>
      {withText && (
        <span
          className="font-display"
          style={{
            fontSize: size * 0.58,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          Quizzo<span style={{ color: 'var(--accent-deep)' }}>.</span>
        </span>
      )}
    </div>
  )
}
