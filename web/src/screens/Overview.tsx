import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Database, Mail, RefreshCw, Share2, ShieldCheck, Ticket, UserPlus, Users as UsersIcon } from 'lucide-react';
import { api } from '../api';
import type { Audit, Stats } from '../types';
import { actionLabel, relative } from '../format';

const STALE_HOURS = 26;

export function Overview({ onToast, onGo }: { onToast: (s: string) => void; onGo: (v: 'users' | 'settings') => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([api.stats(), api.audit()]);
      setStats(s);
      setAudit(a.slice(0, 6));
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { load(); }, [load]);
  // Mientras un catálogo se está actualizando, se mira cada 15 segundos
  useEffect(() => {
    if (!stats?.catalogs?.some((c) => c.scraping)) return;
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [stats, load]);

  const refresh = async (store?: string) => {
    setRefreshing(store ?? 'all');
    try {
      const r = await api.refreshCatalog(store);
      onToast(r.status === 'ya en marcha' ? 'Ya se estaba actualizando' : 'Actualización iniciada: tarda unos minutos');
      setTimeout(load, 1500);
    } catch (e) { onToast((e as Error).message); } finally { setRefreshing(null); }
  };

  const s = stats;
  const signups = s?.signups ?? [];
  const max = Math.max(1, ...signups.map((d) => d.n));
  const newMonth = signups.reduce((a, d) => a + d.n, 0);
  const newWeek = signups.slice(-7).reduce((a, d) => a + d.n, 0);

  return (
    <>
      <div className="row-head">
        <div>
          <h1 className="page-title">Resumen</h1>
          <p className="muted">Cómo va ListPro hoy: usuarios, actividad, catálogos y correo.</p>
        </div>
        <button className="btn" onClick={load} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /> Actualizar</button>
      </div>

      <div className="kpis">
        <Kpi icon={<UsersIcon size={18} />} label="Usuarios" value={s?.total} sub={s ? `${s.pro} Pro · ${s.free} Estándar` : ''} onClick={() => onGo('users')} />
        <Kpi icon={<Activity size={18} />} label="Activos esta semana" value={s?.active7} sub={s?.active30 != null ? `${s.active30} en 30 días` : ''} tone="green" />
        <Kpi icon={<UserPlus size={18} />} label="Altas en 30 días" value={s?.signups ? newMonth : undefined} sub={s?.signups ? `${newWeek} esta semana` : ''} />
        <Kpi icon={<Share2 size={18} />} label="Listas compartidas" value={s?.sharedLists} sub={s?.lists != null ? `de ${s.lists} listas` : ''} />
        <Kpi icon={<Ticket size={18} />} label="Invitaciones libres" value={s?.invitesPending} sub={s ? `${s.invitesUsed} usadas` : ''} />
      </div>

      <div className="grid-2">
        <section className="card panel">
          <h2><UserPlus size={20} /> Altas de los últimos 30 días</h2>
          {signups.length ? (
            <div className="bars" role="img" aria-label={`Altas por día: ${newMonth} en 30 días`}>
              {signups.map((d) => (
                <span key={d.day} className={`bar ${d.n ? '' : 'zero'}`} style={{ '--h': `${Math.max(4, (d.n / max) * 100)}%` } as React.CSSProperties}
                  title={`${new Date(d.day).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}: ${d.n} alta${d.n === 1 ? '' : 's'}`} />
              ))}
            </div>
          ) : <p className="muted small">{loading ? 'Cargando…' : !s ? 'Sin datos de ListPro.' : 'Redespliega ListPro para ver la gráfica de altas.'}</p>}
          {signups.length > 0 && (
            <div className="bars-axis muted tiny">
              <span>{new Date(signups[0].day).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
              <span>Hoy</span>
            </div>
          )}
        </section>

        <section className="card panel">
          <h2><Database size={20} /> Catálogos</h2>
          {!s?.catalogs && <p className="muted small">{loading ? 'Cargando…' : !s ? 'Sin datos de ListPro.' : 'Redespliega ListPro para ver el estado de los catálogos.'}</p>}
          {s?.catalogs?.map((c) => {
            const hours = c.updatedAt ? (Date.now() - Date.parse(c.updatedAt)) / 3_600_000 : Infinity;
            const stale = hours > STALE_HOURS;
            return (
              <div key={c.id} className="catalog-row">
                <span className="store-dot" style={{ background: c.hue }} />
                <div>
                  <b>{c.name}</b>
                  <span className="muted small num">{c.count.toLocaleString('es-ES')} productos · {c.scraping ? 'actualizando…' : `precios ${relative(c.updatedAt)}`}</span>
                </div>
                {stale && !c.scraping && <span className="badge warn"><AlertTriangle size={12} /> Desactualizado</span>}
                <button className="btn small" disabled={c.scraping || refreshing != null} onClick={() => refresh(c.id)}>
                  <RefreshCw size={15} className={c.scraping || refreshing === c.id ? 'spin' : ''} /> {c.scraping ? 'En marcha' : 'Actualizar'}
                </button>
              </div>
            );
          })}
          {s?.catalogs && (
            <button className="btn" disabled={refreshing != null || s.catalogs.some((c) => c.scraping)} onClick={() => refresh()}>
              <RefreshCw size={16} /> Actualizar todos
            </button>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="card panel">
          <h2><Mail size={20} /> Correo</h2>
          {!s ? <p className="muted small">Sin datos de ListPro.</p> : s.smtpConfigured
            ? <p className="small"><span className="badge pro"><ShieldCheck size={12} /> Configurado</span> Los usuarios pueden recuperar su contraseña por email.</p>
            : <p className="small"><span className="badge warn"><AlertTriangle size={12} /> Sin configurar</span> Sin SMTP no llegan los correos para recuperar la contraseña.</p>}
          <button className="btn" onClick={() => onGo('settings')}>Ir a los ajustes de correo</button>
        </section>

        <section className="card panel">
          <h2><Activity size={20} /> Últimos cambios en el panel</h2>
          {!audit.length && <p className="muted small">Todavía no hay cambios.</p>}
          <ul className="audit">
            {audit.map((a) => <AuditItem key={a.id} a={a} />)}
          </ul>
        </section>
      </div>
    </>
  );
}

function Kpi({ icon, label, value, sub, tone, onClick }: { icon: React.ReactNode; label: string; value?: number; sub?: string; tone?: 'green'; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`kpi ${tone ?? ''}`} onClick={onClick}>
      <span className="kpi-icon">{icon}</span>
      <b className="num">{value ?? '—'}</b>
      <span className="kpi-label">{label}</span>
      {sub && <span className="muted tiny">{sub}</span>}
    </Tag>
  );
}

export function AuditItem({ a }: { a: Audit }) {
  let d: Record<string, string> = {};
  try { d = a.details ? JSON.parse(a.details) : {}; } catch { /* detalles antiguos */ }
  const who = d.name ? `${d.name}${d.email ? ` (${d.email})` : ''}` : a.target ?? '';
  const extra = a.action === 'user.plan' && d.plan ? ` → ${d.plan === 'pro' ? 'Pro' : 'Estándar'}` : '';
  return (
    <li>
      <span><b>{actionLabel(a.action)}</b>{who ? ` · ${who}` : ''}{extra}</span>
      <time className="muted tiny" title={new Date(a.at).toLocaleString('es-ES')}>{relative(a.at)}{a.admin ? ` · ${a.admin}` : ''}</time>
    </li>
  );
}
