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
    // Un 401/403 de ListPro es un problema de configuración del panel (token), no de la sesión del administrador:
    // si se devolviera tal cual, la web lo confundiría con "tu sesión ha caducado"
    if (res.status === 401 || res.status === 403) {
      throw Object.assign(new Error('ListPro ha rechazado el token del panel: LISTPRO_ADMIN_TOKEN tiene que ser igual que ADMIN_TOKEN en ListPro.'), { status: 502, code: 'BAD_TOKEN' });
    }
    if (res.status === 503 && /ADMIN_TOKEN/.test(data.error ?? '')) {
      throw Object.assign(new Error('ListPro no tiene ADMIN_TOKEN configurado: añádelo en Coolify y redespliega.'), { status: 502, code: 'NO_TOKEN' });
    }
    if (res.status === 404 && /Cannot (GET|POST|PUT|PATCH|DELETE)/.test(text)) {
      throw Object.assign(new Error('Esta versión de ListPro no tiene esa función: redespliega ListPro.'), { status: 502, code: 'OUTDATED' });
    }
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
  logoutUser: (id) => call(`/api/admin/users/${encodeURIComponent(id)}/logout`, { method: 'POST' }),
  deleteUser: (id) => call(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  refreshCatalog: (store) => call(`/api/admin/refresh${store ? `?store=${encodeURIComponent(store)}` : ''}`, { method: 'POST' }),
  health: () => call('/api/health'),
  regenerateInvite: (id) => call(`/api/admin/users/${encodeURIComponent(id)}/invite`, { method: 'POST' }),
  sendReset: (id) => call(`/api/admin/users/${encodeURIComponent(id)}/reset`, { method: 'POST' }),
  settings: () => call('/api/admin/settings'),
  updateSettings: (body) => call('/api/admin/settings', { method: 'PUT', body }),
  smtp: () => call('/api/admin/smtp'),
  updateSmtp: (body) => call('/api/admin/smtp', { method: 'PUT', body }),
  testSmtp: (to) => call('/api/admin/smtp/test', { method: 'POST', body: { to } }),
  stats: () => call('/api/admin/stats'),
};
