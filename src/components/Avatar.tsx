export default function Avatar({
  user,
  size = 36,
  className = '',
  background = 'var(--accent)',
  textClassName = '',
}: {
  user?: any
  size?: number
  className?: string
  background?: string
  textClassName?: string
}) {
  const label = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || 'Avatar'
  const initial = (user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase()

  return (
    <div
      className={`overflow-hidden grid place-items-center ${className}`.trim()}
      style={{ width: size, height: size, background }}
      aria-label={label}
      title={label}
    >
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt={label} className="w-full h-full object-cover" />
      ) : (
        <span className={`font-bold leading-none ${textClassName}`.trim()}>{initial}</span>
      )}
    </div>
  )
}
