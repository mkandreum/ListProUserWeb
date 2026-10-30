import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, getMeta, setMeta } from './db.js';

const SESSION_HOURS = 12;
export const normalizeEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase().slice(0, 254) : '');

const secret = (() => {
  const env = process.env.PANEL_SESSION_SECRET;
  if (env && env.length >= 32) return env;
  let stored = getMeta('panel_session_secret');
  if (!stored) {
    stored = crypto.randomBytes(48).toString('base64');
    setMeta('panel_session_secret', stored);
    console.warn('[panel] PANEL_SESSION_SECRET no configurado: se ha generado uno y se ha guardado en la base de datos.');
  }
  return stored;
})();

const DUMMY = bcrypt.hashSync('listpro-panel-dummy', 12);
export const hashPassword = (p) => bcrypt.hash(p, 12);
export const checkPassword = async (admin, password) => {
  const ok = await bcrypt.compare(password, admin?.password_hash || DUMMY);
  return Boolean(admin?.password_hash) && ok;
};

export const toAdmin = (a) => ({ id: a.id, email: a.email, name: a.name, role: a.role, createdAt: a.created_at });
export const findByEmail = (email) => db.prepare('SELECT * FROM admins WHERE email = ?').get(email) ?? null;
export const findById = (id) => db.prepare('SELECT * FROM admins WHERE id = ?').get(id) ?? null;

export const signSession = (admin) =>
  jwt.sign({ sub: admin.id }, secret, { expiresIn: SESSION_HOURS * 3600, algorithm: 'HS256' });

export function ensureAdmin() {
  const email = normalizeEmail(process.env.PANEL_ADMIN_EMAIL);
  const password = process.env.PANEL_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('[panel] Faltan PANEL_ADMIN_EMAIL y PANEL_ADMIN_PASSWORD: no se puede entrar al panel.');
    return;
  }
  const id = crypto.createHash('sha256').update(email).digest('hex').slice(0, 24);
  const now = new Date().toISOString();
  const hash = bcrypt.hashSync(password, 12);
  db.prepare(`INSERT INTO admins (id, email, name, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, 'owner', ?)
    ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name`)
    .run(id, email, 'Admin', hash, now);
}

const COOKIE = 'panel_session';

export function readCookie(req, name = COOKIE) {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    maxAge: SESSION_HOURS * 3600_000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function requireAdmin(req, res, next) {
  const token = readCookie(req);
  if (!token) return res.status(401).json({ error: 'Inicia sesión.' });
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const admin = findById(String(payload.sub));
    if (!admin) return res.status(401).json({ error: 'Sesión no válida.' });
    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({ error: 'Tu sesión ha caducado. Vuelve a entrar.' });
  }
}

/** Límite en memoria por clave (una sola instancia). */
export function rateLimit(max, windowMs, keyOf, message) {
  const hits = new Map();
  return (req, res, next) => {
    const key = keyOf(req);
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: message });
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    next();
  };
}
