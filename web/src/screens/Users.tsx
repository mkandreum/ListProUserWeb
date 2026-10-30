import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, KeyRound, Mail, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { api } from '../api';
import type { Plan, Stats, User } from '../types';

const fmtDate = (iso: string | null) => iso
  ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const fmtDateTime = (iso: string | null) => iso
  ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

export function Users({ onToast }: { onToast: (s: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<User | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        api.stats(),
        api.users({ q: q.trim(), plan, page }),
      ]);
      setStats(s);
      setUsers(u.users);
      setTotal(u.total);
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, plan, page, onToast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <>
      <div className="row-head">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="muted">Cuentas registradas en ListPro. Los cambios se aplican al instante.</p>
        </div>
        <button className="btn" onClick={load} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /> Actualizar</button>
      </div>

      <div className="stats">
        <Stat label="Usuarios" value={stats?.total ?? '—'} />
        <Stat label="Pro" value={stats?.pro ?? '—'} tone="pro" />
        <Stat label="Estándar" value={stats?.free ?? '—'} />
        <Stat label="Invitaciones usadas" value={stats?.invitesUsed ?? '—'} />
        <Stat label="Invitaciones libres" value={stats?.invitesPending ?? '—'} />
      </div>

      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar por nombre o email" aria-label="Buscar usuarios" />
        </label>
        <select className="select" value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} aria-label="Filtrar por plan">
          <option value="">Todos los planes</option>
          <option value="pro">Pro</option>
          <option value="free">Estándar</option>
        </select>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Plan</th>
              <th>Invitación</th>
              <th>Alta</th>
              <th>Último acceso</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} onClick={() => setSelected(u)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSelected(u); }}>
                <td>
                  <div className="who">
                    <span className="avatar">{u.name.slice(0, 1).toUpperCase()}</span>
                    <span><b>{u.name}</b><small>{u.email}</small></span>
                  </div>
                </td>
                <td><PlanBadge plan={u.plan} /></td>
                <td><code className="invite">{u.inviteUsedAt ? 'usada' : u.inviteCode ?? '—'}</code></td>
                <td className="muted">{fmtDate(u.createdAt)}</td>
                <td className="muted">{fmtDateTime(u.lastLoginAt)}</td>
                <td><ChevronRight size={18} className="chev" /></td>
              </tr>
            ))}
            {!loading && !users.length && (
              <tr><td colSpan={6}><div className="empty">No hay usuarios con ese filtro.</div></td></tr>
            )}
            {loading && !users.length && (
              <tr><td colSpan={6}><div className="empty">Cargando…</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button className="btn small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={16} /> Anterior</button>
        <span className="muted small">{page} de {pages} · {total} usuarios</span>
        <button className="btn small" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Siguiente <ChevronRight size={16} /></button>
      </div>

      {selected && (
        <UserSheet
          user={selected}
          onClose={() => setSelected(null)}
          onUpdated={(u) => { setSelected(u); setUsers((list) => list.map((x) => x.id === u.id ? u : x)); load(); }}
          onToast={onToast}
        />
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'pro' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <b className="num">{value}</b>
      <span>{label}</span>
    </div>
  );
}

export function PlanBadge({ plan }: { plan: Plan }) {
  return <span className={`badge ${plan}`}>{plan === 'pro' ? <><ShieldCheck size={13} /> Pro</> : 'Estándar'}</span>;
}

function UserSheet({ user, onClose, onUpdated, onToast }: {
  user: User;
  onClose: () => void;
  onUpdated: (u: User) => void;
  onToast: (s: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>(user.plan);
  const [invite, setInvite] = useState(user.inviteCode);
  const [inviteUsed, setInviteUsed] = useState(user.inviteUsedAt);

  const changePlan = async (next: Plan) => {
    if (next === plan || busy) return;
    setBusy('plan');
    try {
      const u = await api.setPlan(user.id, next);
      setPlan(u.plan);
      onUpdated(u);
      onToast(`${u.name} ahora es ${next === 'pro' ? 'Pro' : 'Estándar'}`);
    } catch (e) { onToast((e as Error).message); } finally { setBusy(null); }
  };

  const regenerate = async () => {
    setBusy('invite');
    try {
      const u = await api.regenerateInvite(user.id);
      setInvite(u.inviteCode);
      setInviteUsed(null);
      onUpdated(u);
      onToast('Invitación nueva generada');
    } catch (e) { onToast((e as Error).message); } finally { setBusy(null); }
  };

  const sendReset = async () => {
    setBusy('reset');
    try {
      await api.sendReset(user.id);
      onToast(`Correo de reset enviado a ${user.email}`);
    } catch (e) { onToast((e as Error).message); } finally { setBusy(null); }
  };

  const copy = async () => {
    if (!invite) return;
    try { await navigator.clipboard.writeText(invite); onToast('Invitación copiada'); }
    catch { onToast(`Invitación: ${invite}`); }
  };

  return (
    <div className="scrim" onClick={onClose} role="presentation">
      <section className="sheet" role="dialog" aria-modal="true" aria-label={`Usuario ${user.name}`} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <div className="who">
            <span className="avatar big">{user.name.slice(0, 1).toUpperCase()}</span>
            <span><h2>{user.name}</h2><small>{user.email}</small></span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>

        <div className="sheet-body">
          <div className="kv"><span>Alta</span><b>{fmtDate(user.createdAt)}</b></div>
          <div className="kv"><span>Último acceso</span><b>{fmtDateTime(user.lastLoginAt)}</b></div>
          <div className="kv"><span>Súper preferido</span><b>{user.store ?? '—'}</b></div>

          <h3>Plan</h3>
          <div className="segmented" role="group" aria-label="Plan del usuario">
            <button aria-pressed={plan === 'pro'} disabled={!!busy} onClick={() => changePlan('pro')}>Pro</button>
            <button aria-pressed={plan === 'free'} disabled={!!busy} onClick={() => changePlan('free')}>Estándar</button>
          </div>
          <p className="muted small">Cambiar el plan no toca la configuración de altas nuevas.</p>

          <h3>Invitación</h3>
          {inviteUsed ? (
            <p className="muted small">La invitación de este usuario ya se usó. Genera una nueva si quieres que invite a alguien más.</p>
          ) : (
            <p className="muted small">Comparte este código para que alguien cree su cuenta.</p>
          )}
          <div className="invite-row">
            <code className="invite big">{invite ?? '—'}</code>
            <button className="btn small" disabled={!invite} onClick={copy}><Copy size={16} /> Copiar</button>
            <button className="btn small" disabled={!!busy} onClick={regenerate}><KeyRound size={16} /> {busy === 'invite' ? 'Generando…' : 'Nueva'}</button>
          </div>

          <h3>Contraseña</h3>
          <p className="muted small">Le enviamos un enlace para que la cambie. Caduca en 1 hora.</p>
          <button className="btn" disabled={!!busy} onClick={sendReset}><Mail size={17} /> {busy === 'reset' ? 'Enviando…' : 'Enviar correo de reset'}</button>
        </div>

        <footer className="sheet-foot">
          <span className="muted small">ID {user.id}</span>
          <button className="btn primary" onClick={onClose}><Check size={17} /> Listo</button>
        </footer>
      </section>
    </div>
  );
}
