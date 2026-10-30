import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Copy, KeyRound, LogOut, Mail, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { api } from '../api';
import type { Plan, Stats, User, UserDetail } from '../types';
import { fmtDate, fmtDateTime, relative } from '../format';

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
              <th>Actividad</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} onClick={() => setSelected(u)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSelected(u); }}>
                <td data-label="Usuario">
                  <div className="who">
                    <span className="avatar">{u.name.slice(0, 1).toUpperCase()}</span>
                    <span><b>{u.name}</b><small>{u.email}</small></span>
                  </div>
                </td>
                <td data-label="Plan"><PlanBadge plan={u.plan} /></td>
                <td data-label="Invitación"><code className="invite">{u.inviteUsedAt ? 'usada' : u.inviteCode ?? '—'}</code></td>
                <td data-label="Alta" className="muted">{fmtDate(u.createdAt)}</td>
                <td data-label="Actividad" className="muted" title={fmtDateTime(u.lastSeenAt ?? u.lastLoginAt)}><Activity iso={u.lastSeenAt ?? u.lastLoginAt} /></td>
                <td className="chev-cell"><ChevronRight size={18} className="chev" /></td>
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
          onDeleted={() => { setSelected(null); load(); }}
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

/** Punto verde si ha usado la app en la última semana. */
function Activity({ iso }: { iso: string | null | undefined }) {
  const recent = iso != null && Date.now() - Date.parse(iso) < 7 * 86_400_000;
  return <span className="activity">{recent && <span className="live-dot" />}{relative(iso)}</span>;
}

function UserSheet({ user, onClose, onUpdated, onDeleted, onToast }: {
  user: User;
  onClose: () => void;
  onUpdated: (u: User) => void;
  onDeleted: () => void;
  onToast: (s: string) => void;
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>(user.plan);
  const [invite, setInvite] = useState(user.inviteCode);
  const [inviteUsed, setInviteUsed] = useState(user.inviteUsedAt);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    let alive = true;
    api.user(user.id).then((d) => alive && setDetail(d)).catch((e) => onToast((e as Error).message));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { alive = false; removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } catch (e) { onToast((e as Error).message); } finally { setBusy(null); }
  };

  const changePlan = (next: Plan) => next !== plan && run('plan', async () => {
    const u = await api.setPlan(user.id, next);
    setPlan(u.plan);
    onUpdated(u);
    onToast(`${u.name} ahora es ${next === 'pro' ? 'Pro' : 'Estándar'}`);
  });

  const regenerate = () => run('invite', async () => {
    const u = await api.regenerateInvite(user.id);
    setInvite(u.inviteCode);
    setInviteUsed(null);
    onUpdated(u);
    onToast('Invitación nueva generada');
  });

  const sendReset = () => run('reset', async () => {
    await api.sendReset(user.id);
    onToast(`Correo para cambiar la contraseña enviado a ${user.email}`);
  });

  const logoutAll = () => run('logout', async () => {
    const d = await api.logoutUser(user.id);
    setDetail(d);
    onToast(`Sesiones de ${user.name} cerradas: tendrá que volver a entrar`);
  });

  const remove = () => run('delete', async () => {
    await api.deleteUser(user.id, typed);
    onToast(`Cuenta de ${user.name} borrada`);
    onDeleted();
  });

  const copy = async () => {
    if (!invite) return;
    try { await navigator.clipboard.writeText(invite); onToast('Invitación copiada'); }
    catch { onToast(`Invitación: ${invite}`); }
  };

  const d = detail;
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
          <div className="kv"><span>Última actividad</span><b title={fmtDateTime(d?.lastSeenAt ?? user.lastSeenAt)}><Activity iso={d?.lastSeenAt ?? user.lastSeenAt ?? user.lastLoginAt} /></b></div>
          <div className="kv"><span>Último inicio de sesión</span><b>{fmtDateTime(user.lastLoginAt)}</b></div>
          <div className="kv"><span>Súper preferido</span><b>{STORE_NAMES[user.store ?? ''] ?? user.store ?? '—'}</b></div>
          <div className="kv"><span>Le invitó</span><b>{d?.invitedByUser ? `${d.invitedByUser.name} · ${d.invitedByUser.email}` : d ? 'Nadie (alta directa)' : '…'}</b></div>

          <h3>Lista de la compra</h3>
          {!d ? <div className="skeleton" /> : !d.list ? <p className="muted small">Todavía no tiene lista en el servidor.</p> : (
            <div className="list-card">
              <div className="members">
                {d.list.members.map((m) => <span key={m.id} className="chip"><span className="dot" style={{ background: m.hue }} />{m.name}{m.id === user.id ? ' (esta cuenta)' : ''}</span>)}
              </div>
              <div className="list-facts small muted num">
                <span>{d.list.products} en la cesta</span>
                <span>{d.list.savedBaskets} compras guardadas</span>
                <span>{d.list.expenses} gastos</span>
                <span>código {d.list.code}</span>
                <span>cambiada {relative(d.list.updatedAt)}</span>
              </div>
            </div>
          )}

          <h3>Plan</h3>
          <div className="segmented" role="group" aria-label="Plan del usuario">
            <button aria-pressed={plan === 'pro'} disabled={!!busy} onClick={() => changePlan('pro')}>Pro</button>
            <button aria-pressed={plan === 'free'} disabled={!!busy} onClick={() => changePlan('free')}>Estándar</button>
          </div>
          <p className="muted small">Cambiar el plan no toca la configuración de altas nuevas.</p>

          <h3>Invitación</h3>
          <p className="muted small">{inviteUsed ? 'Su invitación ya se usó. Genera una nueva si quieres que invite a alguien más.' : 'Comparte este código para que alguien cree su cuenta.'}</p>
          <div className="invite-row">
            <code className="invite big">{invite ?? '—'}</code>
            <button className="btn small" disabled={!invite} onClick={copy}><Copy size={16} /> Copiar</button>
            <button className="btn small" disabled={!!busy} onClick={regenerate}><KeyRound size={16} /> {busy === 'invite' ? 'Generando…' : 'Nueva'}</button>
          </div>
          {d && d.invitees.length > 0 && (
            <div className="invitees">
              <span className="muted small">Ha invitado a {d.invitees.length}:</span>
              {d.invitees.map((x) => <span key={x.id} className="chip" title={x.email}>{x.name}</span>)}
            </div>
          )}

          <h3>Acceso</h3>
          <div className="btn-row">
            <button className="btn" disabled={!!busy} onClick={sendReset}><Mail size={17} /> {busy === 'reset' ? 'Enviando…' : 'Enviar correo para cambiar la contraseña'}</button>
            <button className="btn" disabled={!!busy} onClick={logoutAll}><LogOut size={17} /> {busy === 'logout' ? 'Cerrando…' : 'Cerrar todas sus sesiones'}</button>
          </div>
          <p className="muted small">El enlace del correo caduca en 1 hora. Cerrar sesiones le obliga a entrar de nuevo en todos sus dispositivos.</p>

          <div className="danger-zone">
            {!confirmDelete ? (
              <button className="btn danger" onClick={() => setConfirmDelete(true)}><Trash2 size={17} /> Borrar la cuenta</button>
            ) : (
              <>
                <p className="small"><AlertTriangle size={15} /> Se borra la cuenta para siempre. Su lista sigue existiendo para los demás miembros. Escribe <b>{user.email}</b> para confirmar.</p>
                <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={user.email} autoComplete="off" spellCheck={false} />
                <div className="btn-row">
                  <button className="btn" onClick={() => { setConfirmDelete(false); setTyped(''); }}>Cancelar</button>
                  <button className="btn danger solid" disabled={!!busy || typed.trim().toLowerCase() !== user.email.toLowerCase()} onClick={remove}>
                    <Trash2 size={17} /> {busy === 'delete' ? 'Borrando…' : 'Borrar para siempre'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="sheet-foot">
          <span className="muted small">ID {user.id}</span>
          <button className="btn primary" onClick={onClose}><Check size={17} /> Listo</button>
        </footer>
      </section>
    </div>
  );
}

const STORE_NAMES: Record<string, string> = { mercadona: 'Mercadona', consum: 'Consum', eci: 'El Corte Inglés' };
