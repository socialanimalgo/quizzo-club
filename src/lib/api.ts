const API_BASE = '/api'

export function getToken(): string | null {
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
    answer: (session_id: string, question_id: string, answer_index: number, time_ms: number, powerup_id?: string | null) =>
      apiFetch<{ correct: boolean; correct_index: number; points: number; wallet?: any }>('/quiz/answer', {
        method: 'POST',
        body: JSON.stringify({ session_id, question_id, answer_index, time_ms, powerup_id }),
      }),
    finish: (session_id: string) =>
      apiFetch<{ session: any; xp_earned: number; percentage: number }>('/quiz/finish', {
        method: 'POST',
        body: JSON.stringify({ session_id }),
      }),
    daily: () => apiFetch<{ questions: any[]; already_completed: boolean; completion: any; quiz_date: string }>('/quiz/daily'),
    startDaily: () =>
      apiFetch<{ session_id: string; questions: any[]; already_completed: boolean; quiz_date: string }>('/quiz/daily/start', {
        method: 'POST',
      }),
    session: (id: string) => apiFetch<{ session: any }>(`/quiz/session/${id}`),
  },
  leaderboard: {
    get: (type: 'alltime' | 'weekly' | 'daily' = 'alltime') =>
      apiFetch<{ leaderboard: any[]; my_rank: any }>(`/leaderboard?type=${type}`),
  },
  challenges: {
    create: (category_id: string, mode: 'challenge' | 'hunter' = 'challenge', challenged_user_id?: string) =>
      apiFetch<{ challenge_id: string; share_code: string; session_id: string; questions: any[] }>('/challenges/create', {
        method: 'POST',
        body: JSON.stringify({ category_id, mode, challenged_user_id }),
      }),
    get: (code: string) => apiFetch<{ challenge: any }>(`/challenges/${code}`),
    accept: (code: string) =>
      apiFetch<{ challenge_id: string; session_id: string; category_id: string; mode: string; questions: any[] }>(`/challenges/${code}/accept`, {
        method: 'POST',
      }),
    acceptById: (id: string) =>
      apiFetch<{ challenge_id: string; session_id: string; category_id: string; mode: string; questions: any[] }>(`/challenges/by-id/${id}/accept`, {
        method: 'POST',
      }),
    incoming: () => apiFetch<{ challenges: any[] }>('/challenges/incoming'),
    history: () => apiFetch<{ history: any[] }>('/challenges/history'),
    complete: (id: string) => apiFetch<any>(`/challenges/${id}/complete`, { method: 'POST' }),
  },
  kvizopoli: {
    create: () => apiFetch<{ match: any }>('/kvizopoli/create', { method: 'POST' }),
    join: (join_code: string) => apiFetch<{ match: any }>('/kvizopoli/join', { method: 'POST', body: JSON.stringify({ join_code }) }),
    state: (id: string) => apiFetch<{ match: any }>(`/kvizopoli/matches/${id}`),
    start: (id: string) => apiFetch<{ match: any }>(`/kvizopoli/matches/${id}/start`, { method: 'POST' }),
    roll: (id: string) => apiFetch<{ match: any }>(`/kvizopoli/matches/${id}/roll`, { method: 'POST' }),
    leave: (id: string) => apiFetch<{ ok: boolean; deleted?: boolean; match?: any }>(`/kvizopoli/matches/${id}/leave`, { method: 'POST' }),
    answer: (id: string, answer_id: string) =>
      apiFetch<{ match: any; correct: boolean }>(`/kvizopoli/matches/${id}/answer`, { method: 'POST', body: JSON.stringify({ answer_id }) }),
    invite: (id: string, user_id: string) =>
      apiFetch<{ ok: boolean }>(`/kvizopoli/matches/${id}/invite`, { method: 'POST', body: JSON.stringify({ user_id }) }),
    streamUrl: (id: string) => {
      const token = getToken()
      return token ? `${API_BASE}/kvizopoli/matches/${id}/stream?access_token=${encodeURIComponent(token)}` : null
    },
  },
  notifications: {
    list: (filter: 'all' | 'unread' = 'all') =>
      apiFetch<{ notifications: any[]; counts: { all_count: number; unread_count: number } }>(`/notifications?filter=${filter}`),
    summary: () => apiFetch<{ unread_count: number }>('/notifications/summary'),
    markRead: (id: string) => apiFetch<{ notification: any }>(`/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: () => apiFetch<{ ok: boolean }>('/notifications/mark-all-read', { method: 'POST' }),
    streamUrl: () => {
      const token = getToken()
      return token ? `${API_BASE}/notifications/stream?access_token=${encodeURIComponent(token)}` : null
    },
  },
  users: {
    search: (q: string) => apiFetch<{ users: any[] }>(`/users/search?q=${encodeURIComponent(q)}`),
    get: (id: string) => apiFetch<{ user: any }>(`/users/${id}`),
    friends: () => apiFetch<{ friends: any[]; requests: any[] }>('/users/friends'),
    sendFriendRequest: (user_id: string) =>
      apiFetch<{ request: any; accepted?: boolean }>('/users/friends/request', {
        method: 'POST',
        body: JSON.stringify({ user_id }),
      }),
    respondToFriendRequest: (requestId: string, action: 'accept' | 'decline') =>
      apiFetch<{ ok: boolean }>(`/users/friends/requests/${requestId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
  },
  subscription: {
    get: () => apiFetch<any>('/subscription'),
    createCheckout: (plan: string) =>
      apiFetch<{ url: string }>('/stripe/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
    getPortal: () =>
      apiFetch<{ url: string }>('/stripe/portal', { method: 'POST' }),
  },
  shop: {
    catalog: () => apiFetch<{ powerups: any[]; bundles: any[]; gemPacks: any[] }>('/shop/catalog'),
    wallet: () => apiFetch<{ coins: number; gems: number; inv: Record<string, number> }>('/shop/wallet'),
    buyPowerup: (body: { powerup_id: string; currency: 'coins' | 'gems'; qty?: number }) =>
      apiFetch<{ wallet: any; purchase: any }>('/shop/buy-powerup', { method: 'POST', body: JSON.stringify(body) }),
    buyBundle: (bundle_id: string) =>
      apiFetch<{ wallet: any; purchase: any }>('/shop/buy-bundle', { method: 'POST', body: JSON.stringify({ bundle_id }) }),
    buyGems: (pack_id: string) =>
      apiFetch<{ url?: string; checkout_url?: string }>('/shop/buy-gems', { method: 'POST', body: JSON.stringify({ pack_id }) }),
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
    users: (q = '', page = 1) => apiFetch<{ users: any[]; total: number }>(`/admin/users?q=${encodeURIComponent(q)}&offset=${(page - 1) * 50}`),
    block: (id: string) => apiFetch<{ user: any }>(`/admin/users/${id}/block`, { method: 'POST' }),
    unblock: (id: string) => apiFetch<{ user: any }>(`/admin/users/${id}/unblock`, { method: 'POST' }),
    delete: (id: string) => apiFetch<{ ok: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
    gift: (id: string, body: any) => apiFetch<{ user: any; wallet: any }>(`/admin/users/${id}/gift`, { method: 'POST', body: JSON.stringify(body) }),
    notify: (id: string, message: string) => apiFetch<{ notification: any }>(`/admin/users/${id}/notify`, { method: 'POST', body: JSON.stringify({ message }) }),
    categories: () => apiFetch<{ categories: any[] }>('/admin/categories'),
    powerups: () => apiFetch<{ totals: any; per_type: any[] }>('/admin/powerups'),
    getQuestions: (params?: { category?: string; page?: number }) => {
      const qs = new URLSearchParams()
      if (params?.category) qs.set('category', params.category)
      if (params?.page) qs.set('page', String(params.page))
      return apiFetch<{ questions: any[]; total: number }>(`/admin/questions?${qs}`)
    },
    searchQuestions: (q: string, exclude: string[] = []) =>
      apiFetch<{ questions: any[] }>(`/admin/questions/search?q=${encodeURIComponent(q)}&exclude=${exclude.join(',')}`),
    dailyQuizzes: (from: string, to: string) =>
      apiFetch<{ quizzes: { date: string; question_count: number; scheduled: boolean }[] }>(`/admin/daily-quizzes?from=${from}&to=${to}`),
    dailyQuizDetail: (date: string) =>
      apiFetch<{ date: string; questions: any[] }>(`/admin/daily-quizzes/${date}`),
    updateDailyQuiz: (date: string, question_ids: string[]) =>
      apiFetch<{ ok: boolean; date: string; count: number }>(`/admin/daily-quizzes/${date}`, {
        method: 'PUT',
        body: JSON.stringify({ question_ids }),
      }),
    scheduleDailyQuizzes: (days = 30) =>
      apiFetch<{ ok: boolean; scheduled: number; skipped: number }>('/admin/daily-quizzes/schedule', {
        method: 'POST',
        body: JSON.stringify({ days }),
      }),
  },
}
