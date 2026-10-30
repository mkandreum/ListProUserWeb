const BASE = (process.env.LISTPRO_API_URL ?? '').replace(/\/+$/, '');
const TOKEN = process.env.LISTPRO_ADMIN_TOKEN ?? '';

async function call(path, { method = 'GET', body } = {}) {
  if (!BASE || !TOKEN) {
    throw Object.assign(new Error('Faltan LISTPRO_API_URL o LISTPRO_ADMIN_TOKEN en el panel.'), { status: 503 });
  }
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    throw Object.assign(new Error(`No se pudo conectar con ListPro: ${e.message}`), { status: 502 });
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 200) }; }
  if (!res.ok) {
    throw Object.assign(new Error(data.error || `ListPro respondió ${res.status}`), { status: res.status, data });
  }
  return data;
}

export const listpro = {
  users: (params = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    return call(`/api/admin/users${qs.toString() ? `?${qs}` : ''}`);
  },
  user: (id) => call(`/api/admin/users/${encodeURIComponent(id)}`),
  setPlan: (id, plan) => call(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: { plan } }),
  regenerateInvite: (id) => call(`/api/admin/users/${encodeURIComponent(id)}/invite`, { method: 'POST' }),
  sendReset: (id) => call(`/api/admin/users/${encodeURIComponent(id)}/reset`, { method: 'POST' }),
  settings: () => call('/api/admin/settings'),
  updateSettings: (body) => call('/api/admin/settings', { method: 'PUT', body }),
  smtp: () => call('/api/admin/smtp'),
  updateSmtp: (body) => call('/api/admin/smtp', { method: 'PUT', body }),
  testSmtp: (to) => call('/api/admin/smtp/test', { method: 'POST', body: { to } }),
  stats: () => call('/api/admin/stats'),
};
