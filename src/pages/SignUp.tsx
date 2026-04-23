import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, setToken } from '../lib/api'

export default function SignUp() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await api.auth.register(form)
      setToken(token)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Registracija neuspješna')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)' }}>
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-6 max-w-md mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="btl btl-sm sh-2 w-9 h-9 grid place-items-center" style={{ background: '#fff' }}>←</Link>
          <img src="/quizzo-icon.jpg" alt="Quizzo" className="w-10 h-10 btl btl-sm sh-2" style={{ objectFit: 'cover' }} />
          <div className="w-9" />
        </div>

        <div className="font-display text-[30px] tracking-tight leading-none mb-1">Stvori račun</div>
        <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-6">
          // PRIDRUŽI SE BESPLATNO
        </div>

        {/* Google */}
        <a href="/api/auth/google" className="btn w-full mb-3 flex items-center justify-center gap-3" style={{ padding: '14px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Nastavi s Googleom
        </a>

        {/* Divider */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-[2px]" style={{ background: 'var(--line)' }} />
          <span className="font-mono text-[10px] font-bold opacity-60">ILI</span>
          <div className="flex-1 h-[2px]" style={{ background: 'var(--line)' }} />
        </div>

        {error && (
          <div className="btl p-3 mb-4 font-mono text-[11px] font-bold" style={{ background: '#fecaca', borderColor: '#dc2626' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <input className="inp" placeholder="Ime" value={form.first_name}
              onChange={e => set('first_name', e.target.value)} required />
            <input className="inp" placeholder="Prezime" value={form.last_name}
              onChange={e => set('last_name', e.target.value)} />
          </div>
          <input className="inp" type="email" placeholder="email@primjer.com"
            value={form.email} onChange={e => set('email', e.target.value)} required />
          <input className="inp" type="password" placeholder="Lozinka (min. 8 znakova)"
            value={form.password} onChange={e => set('password', e.target.value)}
            required minLength={8} />
          <button type="submit" disabled={loading} className="btn btn-primary w-full"
            style={{ padding: '14px', fontSize: 15 }}>
            {loading ? '…' : 'Stvori račun →'}
          </button>
        </form>

        <div className="text-center font-mono text-[11px]">
          Već imaš račun?{' '}
          <Link to="/signin" className="font-bold underline" style={{ color: 'var(--accent-deep)' }}>
            Prijavi se
          </Link>
        </div>
      </div>
    </div>
  )
}
