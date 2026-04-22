const API_BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('lingee-token')
}

export function setToken(token: string) {
  localStorage.setItem('lingee-token', token)
}

export function clearToken() {
  localStorage.removeItem('lingee-token')
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || res.statusText)
  }
  return res.json()
}

export const api = {
  auth: {
    getUser: () => apiFetch<{ user: any }>('/auth/me').then(r => r.user).catch(() => null),
    login: (email: string, password: string) =>
      apiFetch<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (data: { email: string; password: string; first_name: string; last_name: string }) =>
      apiFetch<{ token: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    logout: () => { clearToken() },
  },
  progress: {
    load: () => apiFetch<{ progress: any; completions: any[] }>('/progress'),
    save: (data: any) => apiFetch('/progress', { method: 'PUT', body: JSON.stringify(data) }),
  },
  completions: {
    save: (data: any) => apiFetch('/completions', { method: 'POST', body: JSON.stringify(data) }),
  },
  certificates: {
    save: (data: any) => apiFetch('/certificates', { method: 'POST', body: JSON.stringify(data) }),
    verify: (number: string) => apiFetch<{ certificate: any }>(`/certificates/${encodeURIComponent(number)}`),
  },
  subscription: {
    get: () => apiFetch<any>('/subscription'),
    createCheckout: (plan: string) =>
      apiFetch<{ url: string }>('/stripe/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
    getPortal: () =>
      apiFetch<{ url: string }>('/stripe/portal', { method: 'POST' }),
  },
  analytics: {
    visit: () => {
      const token = getToken()
      fetch(`${API_BASE}/analytics/visit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }).catch(() => {})
    },
  },
  admin: {
    getStats: () => apiFetch<any>('/admin/stats'),
  },
}
