import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { api, setToken } from '../lib/api'
import QuizzoLogo from '../components/QuizzoLogo'

export default function SignIn() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const token = params.get('token')
    const err = params.get('error')
    if (token) { setToken(token); navigate('/', { replace: true }) }
    if (err) {
      const msgs: Record<string, string> = {
        google_cancelled: 'Google prijava otkazana.',
        token_failed: 'Google prijava neuspješna.',
        no_email: 'Email nije dostupan.',
        apple_cancelled: 'Apple prijava otkazana.',
        blocked: 'Račun je blokiran.',
        server_error: 'Greška servera. Pokušaj ponovo.',
      }
      setError(msgs[err] || 'Prijava neuspješna.')
    }
  }, [params, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await api.auth.login(email, password)
      setToken(token)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Prijava neuspješna')
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
          <QuizzoLogo size={40} />
          <div className="w-9" />
        </div>

        <div className="font-display text-[30px] tracking-tight leading-none mb-1">Dobrodošao/la</div>
        <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 mb-6">
          // PRIJAVI SE I NASTAVI
        </div>

        <div className="grid grid-cols-1 gap-2 mb-3">
          <a href="/api/auth/apple" className="btn w-full flex items-center justify-center gap-3" style={{ padding: '14px', background: '#111014', color: '#fff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.365 1.43c0 1.14-.42 2.2-1.12 2.97-.76.84-2 1.48-3.08 1.39-.14-1.08.39-2.22 1.12-2.97.8-.84 2.14-1.44 3.08-1.39zM20.94 17.16c-.48 1.1-.7 1.59-1.32 2.56-.86 1.36-2.08 3.05-3.59 3.06-1.34.01-1.69-.87-3.5-.86-1.81.01-2.2.88-3.54.87-1.5-.01-2.66-1.54-3.52-2.9-2.41-3.8-2.66-8.26-1.17-10.56 1.06-1.64 2.73-2.61 4.29-2.61 1.59 0 2.59.87 3.9.87 1.27 0 2.04-.87 3.89-.87 1.39 0 2.86.76 3.92 2.08-3.44 1.89-2.88 6.8.64 8.46z"/></svg>
            Nastavi s Appleom
          </a>
          <a href="/api/auth/google" className="btn w-full flex items-center justify-center gap-3" style={{ padding: '14px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Nastavi s Googleom
          </a>
        </div>

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
          <input className="inp" type="email" placeholder="email@primjer.com"
            value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="inp" type="password" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading} className="btn btn-primary w-full"
            style={{ padding: '14px', fontSize: 15 }}>
            {loading ? '…' : 'Prijavi se →'}
          </button>
        </form>

        <div className="text-center font-mono text-[11px]">
          Nemaš račun?{' '}
          <Link to="/signup" className="font-bold underline" style={{ color: 'var(--accent-deep)' }}>
            Registriraj se
          </Link>
        </div>
      </div>
    </div>
  )
}
