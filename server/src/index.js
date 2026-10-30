import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import {
  checkPassword, clearSessionCookie, ensureAdmin, findByEmail, normalizeEmail, rateLimit, requireAdmin,
  setSessionCookie, signSession, toAdmin,
} from './auth.js';
import { listpro } from './listpro.js';

const PORT = Number(process.env.PORT ?? 3000);
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const ip = (req) => req.ip || 'x';
const loginLimit = rateLimit(10, 15 * 60_000, (req) => `${ip(req)}:${normalizeEmail(req.body?.email)}`, 'Demasiados intentos. Espera unos minutos.');

ensureAdmin();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

// El panel es same-origin. SameSite=Strict en la cookie + comprobación de Origin.
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');
    const expected = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
    if (origin && origin !== expected) return res.status(403).json({ error: 'Origen no permitido.' });
  }
  next();
});

/** Nombre y email del usuario afectado, para que la auditoría se entienda sin buscar ids. */
async function who(id) {
  try { const u = await listpro.user(id); return { name: u.name, email: u.email }; } catch { return {}; }
}

function audit(req, action, target = null, details = null) {
  db.prepare('INSERT INTO audit (admin_id, action, target, details, ip, at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.admin?.id ?? null, action, target, details ? JSON.stringify(details) : null, ip(req), new Date().toISOString());
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Estado de la conexión con ListPro, para avisar en el panel en vez de fallar pantalla a pantalla
app.get('/api/status', requireAdmin, async (_req, res) => {
  const out = { listproUrl: process.env.LISTPRO_API_URL || null, reachable: false, tokenOk: false, error: null };
  try {
    await listpro.health();
    out.reachable = true;
    await listpro.stats();
    out.tokenOk = true;
  } catch (e) {
    out.error = e.message;
  }
  res.json(out);
});

app.post('/api/auth/login', loginLimit, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const admin = email ? findByEmail(email) : null;
  if (!(await checkPassword(admin, password))) return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  setSessionCookie(res, signSession(admin));
  res.json(toAdmin(admin));
});

app.get('/api/auth/me', requireAdmin, (req, res) => res.json(toAdmin(req.admin)));
app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

// --- Usuarios (proxy a ListPro) ---
app.get('/api/users', requireAdmin, async (req, res, next) => {
  try {
    res.json(await listpro.users({
      q: req.query.q, plan: req.query.plan, page: req.query.page, limit: req.query.limit,
    }));
  } catch (e) { next(e); }
});

app.get('/api/users/:id', requireAdmin, async (req, res, next) => {
  try { res.json(await listpro.user(req.params.id)); } catch (e) { next(e); }
});

app.post('/api/users/:id/plan', requireAdmin, async (req, res, next) => {
  try {
    const plan = req.body?.plan === 'pro' ? 'pro' : req.body?.plan === 'free' ? 'free' : null;
    if (!plan) return res.status(400).json({ error: 'Plan no válido.' });
    const user = await listpro.setPlan(req.params.id, plan);
    audit(req, 'user.plan', req.params.id, { plan, name: user.name, email: user.email });
    res.json(user);
  } catch (e) { next(e); }
});

app.post('/api/users/:id/invite', requireAdmin, async (req, res, next) => {
  try {
    const user = await listpro.regenerateInvite(req.params.id);
    audit(req, 'user.invite', req.params.id, { name: user.name, email: user.email });
    res.json(user);
  } catch (e) { next(e); }
});

app.post('/api/users/:id/reset', requireAdmin, async (req, res, next) => {
  try {
    const result = await listpro.sendReset(req.params.id);
    audit(req, 'user.reset', req.params.id, await who(req.params.id));
    res.json(result);
  } catch (e) { next(e); }
});

app.post('/api/users/:id/logout', requireAdmin, async (req, res, next) => {
  try {
    const user = await listpro.logoutUser(req.params.id);
    audit(req, 'user.logout', req.params.id, { name: user.name, email: user.email });
    res.json(user);
  } catch (e) { next(e); }
});

// Borrar exige escribir el email del usuario: así no se borra a nadie por un clic despistado
app.delete('/api/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const target = await listpro.user(req.params.id);
    if (normalizeEmail(req.body?.confirm) !== normalizeEmail(target.email))
      return res.status(400).json({ error: 'Escribe el email del usuario para confirmar.' });
    await listpro.deleteUser(req.params.id);
    audit(req, 'user.delete', req.params.id, { name: target.name, email: target.email });
    res.status(204).end();
  } catch (e) { next(e); }
});

app.post('/api/catalog/refresh', requireAdmin, async (req, res, next) => {
  try {
    const store = typeof req.body?.store === 'string' ? req.body.store : '';
    const result = await listpro.refreshCatalog(store);
    audit(req, 'catalog.refresh', store || 'todos');
    res.json(result);
  } catch (e) { next(e); }
});

// --- Ajustes y SMTP ---
app.get('/api/settings', requireAdmin, async (_req, res, next) => {
  try { res.json(await listpro.settings()); } catch (e) { next(e); }
});

app.put('/api/settings', requireAdmin, async (req, res, next) => {
  try {
    const settings = await listpro.updateSettings({
      newUserPlan: req.body?.newUserPlan,
      registrationMode: req.body?.registrationMode,
    });
    audit(req, 'settings.update', null, { newUserPlan: req.body?.newUserPlan, registrationMode: req.body?.registrationMode });
    res.json(settings);
  } catch (e) { next(e); }
});

app.get('/api/smtp', requireAdmin, async (_req, res, next) => {
  try { res.json(await listpro.smtp()); } catch (e) { next(e); }
});

app.put('/api/smtp', requireAdmin, async (req, res, next) => {
  try {
    const smtp = await listpro.updateSmtp({
      host: req.body?.host, port: req.body?.port, user: req.body?.user,
      pass: req.body?.pass, secure: req.body?.secure, from: req.body?.from,
    });
    audit(req, 'smtp.update', null, { host: req.body?.host, user: req.body?.user });
    res.json(smtp);
  } catch (e) { next(e); }
});

app.post('/api/smtp/test', requireAdmin, async (req, res, next) => {
  try {
    const result = await listpro.testSmtp(req.body?.to);
    audit(req, 'smtp.test', null, { to: req.body?.to });
    res.json(result);
  } catch (e) { next(e); }
});

app.get('/api/stats', requireAdmin, async (_req, res, next) => {
  try { res.json(await listpro.stats()); } catch (e) { next(e); }
});

app.get('/api/audit', requireAdmin, (_req, res) => {
  res.json(db.prepare(`SELECT a.id, a.action, a.target, a.details, a.at, ad.email AS admin
    FROM audit a LEFT JOIN admins ad ON ad.id = a.admin_id ORDER BY a.id DESC LIMIT 200`).all());
});

app.use(compression());
// Cabeceras de seguridad: el panel no se incrusta en otras webs ni se indexa
app.use((_req, res, next) => {
  res.set('X-Frame-Options', 'DENY');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});
app.use(express.static(publicDir, {
  setHeaders(res, file) {
    if (file.endsWith('.html') || file.endsWith('sw.js')) res.set('Cache-Control', 'no-store');
  },
}));

app.use((err, _req, res, _next) => {
  const status = Number(err.status) >= 400 && Number(err.status) < 600 ? Number(err.status) : 502;
  console.error('[panel]', err.message);
  res.status(status).json({ error: err.message || 'No se pudo conectar con ListPro.' });
});

app.listen(PORT, () => console.log(`ListPro UserWeb escuchando en http://localhost:${PORT}`));
