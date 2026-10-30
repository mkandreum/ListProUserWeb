import type { Admin, Audit, PanelStatus, Plan, Settings, Smtp, Stats, User, UserDetail } from './types';

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    // La sesión del panel caducó: la app vuelve al login (salvo en el propio login y en /me)
    if (res.status === 401 && !path.startsWith('/api/auth/')) dispatchEvent(new Event('panel:logout'));
    const message = (data as { error?: string } | null)?.error ?? `Error ${res.status}`;
    throw Object.assign(new Error(message), { status: res.status });
  }
  return data as T;
}

export const api = {
  me: () => req<Admin>('/api/auth/me'),
  login: (email: string, password: string) =>
    req<Admin>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => req<void>('/api/auth/logout', { method: 'POST' }),

  users: (params: { q?: string; plan?: string; page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.plan) qs.set('plan', params.plan);
    if (params.page) qs.set('page', String(params.page));
    return req<{ users: User[]; total: number; page: number; pageSize: number }>(`/api/users${qs.toString() ? `?${qs}` : ''}`);
  },
  user: (id: string) => req<UserDetail>(`/api/users/${encodeURIComponent(id)}`),
  logoutUser: (id: string) => req<UserDetail>(`/api/users/${encodeURIComponent(id)}/logout`, { method: 'POST' }),
  deleteUser: (id: string, confirm: string) =>
    req<void>(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ confirm }) }),
  refreshCatalog: (store?: string) => req<{ status: string }>('/api/catalog/refresh', { method: 'POST', body: JSON.stringify({ store: store ?? '' }) }),
  status: () => req<PanelStatus>('/api/status'),
  setPlan: (id: string, plan: Plan) =>
    req<User>(`/api/users/${encodeURIComponent(id)}/plan`, { method: 'POST', body: JSON.stringify({ plan }) }),
  regenerateInvite: (id: string) =>
    req<User>(`/api/users/${encodeURIComponent(id)}/invite`, { method: 'POST' }),
  sendReset: (id: string) =>
    req<{ ok: boolean }>(`/api/users/${encodeURIComponent(id)}/reset`, { method: 'POST' }),

  settings: () => req<Settings>('/api/settings'),
  saveSettings: (body: { newUserPlan: Plan; registrationMode: 'invite' | 'open' }) =>
    req<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  smtp: () => req<Smtp>('/api/smtp'),
  saveSmtp: (body: Partial<Smtp>) =>
    req<Smtp>('/api/smtp', { method: 'PUT', body: JSON.stringify(body) }),
  testSmtp: (to: string) =>
    req<{ ok: boolean }>('/api/smtp/test', { method: 'POST', body: JSON.stringify({ to }) }),

  stats: () => req<Stats>('/api/stats'),
  audit: () => req<Audit[]>('/api/audit'),
};
