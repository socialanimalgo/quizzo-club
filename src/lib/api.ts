const API_BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('quizzo-token')
}

export function setToken(token: string) {
  localStorage.setItem('quizzo-token', token)
}

export function clearToken() {
  localStorage.removeItem('quizzo-token')
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
  quiz: {
    categories: () => apiFetch<{ categories: any[] }>('/quiz/categories'),
    start: (category_id: string, count = 10) =>
      apiFetch<{ session_id: string; questions: any[] }>('/quiz/start', {
        method: 'POST',
        body: JSON.stringify({ category_id, count }),
      }),
    answer: (session_id: string, question_id: string, answer_index: number, time_ms: number) =>
      apiFetch<{ correct: boolean; correct_index: number; points: number }>('/quiz/answer', {
        method: 'POST',
        body: JSON.stringify({ session_id, question_id, answer_index, time_ms }),
      }),
    finish: (session_id: string) =>
      apiFetch<{ session: any; xp_earned: number; percentage: number }>('/quiz/finish', {
        method: 'POST',
        body: JSON.stringify({ session_id }),
      }),
    daily: () => apiFetch<{ questions: any[]; already_completed: boolean; completion: any }>('/quiz/daily'),
    session: (id: string) => apiFetch<{ session: any }>(`/quiz/session/${id}`),
  },
  leaderboard: {
    get: (type: 'alltime' | 'weekly' | 'daily' = 'alltime') =>
      apiFetch<{ leaderboard: any[]; my_rank: any }>(`/leaderboard?type=${type}`),
  },
  challenges: {
    create: (category_id: string, mode: 'challenge' | 'hunter' = 'challenge') =>
      apiFetch<{ challenge_id: string; share_code: string; session_id: string; questions: any[] }>('/challenges/create', {
        method: 'POST',
        body: JSON.stringify({ category_id, mode }),
      }),
    get: (code: string) => apiFetch<{ challenge: any }>(`/challenges/${code}`),
    accept: (code: string) =>
      apiFetch<{ challenge_id: string; session_id: string; category_id: string; mode: string; questions: any[] }>(`/challenges/${code}/accept`, {
        method: 'POST',
      }),
    complete: (id: string) => apiFetch<any>(`/challenges/${id}/complete`, { method: 'POST' }),
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
    getQuestions: (params?: { category?: string; page?: number }) => {
      const qs = new URLSearchParams()
      if (params?.category) qs.set('category', params.category)
      if (params?.page) qs.set('page', String(params.page))
      return apiFetch<{ questions: any[]; total: number }>(`/admin/questions?${qs}`)
    },
  },
}
