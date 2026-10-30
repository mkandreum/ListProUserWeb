import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, LayoutDashboard, LogOut, Moon, Settings as SettingsIcon, ShoppingBasket, Sun, Users as UsersIcon } from 'lucide-react';
import { api } from './api';
import type { Admin, PanelStatus } from './types';
import { Login } from './screens/Login';
import { Overview } from './screens/Overview';
import { Users } from './screens/Users';
import { Settings } from './screens/Settings';

type View = 'overview' | 'users' | 'settings';
type Theme = 'dark' | 'light';

const VIEWS: View[] = ['overview', 'users', 'settings'];
const viewFromHash = (): View => {
  const v = location.hash.replace('#/', '') as View;
  return VIEWS.includes(v) ? v : 'overview';
};

// El tema se recuerda; la primera vez, el del sistema
const initialTheme = (): Theme => {
  try {
    const t = localStorage.getItem('panelTheme');
    if (t === 'dark' || t === 'light') return t;
  } catch { /* sin almacenamiento */ }
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export function App() {
  const [admin, setAdmin] = useState<Admin | null | undefined>(undefined);
  const [view, setViewState] = useState<View>(viewFromHash);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [toast, setToast] = useState<string | null>(null);
  const [status, setStatus] = useState<PanelStatus | null>(null);

  // La sección va en la URL (#/users): se puede recargar sin perder dónde estabas
  const setView = useCallback((v: View) => { setViewState(v); history.replaceState(null, '', `#/${v}`); }, []);
  useEffect(() => {
    const onHash = () => setViewState(viewFromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('panelTheme', theme); } catch { /* sin almacenamiento */ }
  }, [theme]);

  useEffect(() => {
    api.me().then(setAdmin).catch(() => setAdmin(null));
    // Cualquier 401 del panel (sesión caducada) vuelve al login
    const onLogout = () => setAdmin(null);
    addEventListener('panel:logout', onLogout);
    return () => removeEventListener('panel:logout', onLogout);
  }, []);

  // Al entrar, comprobar que el panel llega a ListPro y que el token vale
  useEffect(() => {
    if (!admin) return;
    api.status().then(setStatus).catch(() => setStatus(null));
  }, [admin]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const logout = async () => {
    await api.logout().catch(() => {});
    setAdmin(null);
  };

  if (admin === undefined) {
    return <div className="boot"><span className="spinner" /></div>;
  }

  if (!admin) {
    return <Login onLogin={setAdmin} />;
  }

  const tabs: { id: View; label: string; icon: typeof UsersIcon }[] = [
    { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
    { id: 'users', label: 'Usuarios', icon: UsersIcon },
    { id: 'settings', label: 'Ajustes', icon: SettingsIcon },
  ];

  return (
    <div className="admin">
      <header className="topbar">
        <a href="#/overview" className="brand" onClick={(e) => { e.preventDefault(); setView('overview'); }} aria-label="ListPro Admin, inicio">
          <span className="brand-mark"><ShoppingBasket size={26} strokeWidth={2.2} /></span>
          <span className="brand-text">
            <span className="wordmark">List<em>Pro</em> <span className="admin-tag">Admin</span></span>
            <span className="tagline">{admin.email}</span>
          </span>
        </a>
        <div className="topbar-end">
          <nav className="nav" aria-label="Secciones">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} className={view === id ? 'on' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
                <Icon size={18} /> <span>{label}</span>
              </button>
            ))}
          </nav>
          <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'} title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button className="icon-btn" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <main className="page" key={view}>
        {status && (!status.reachable || !status.tokenOk) && (
          <div className="alert" role="alert">
            <AlertTriangle size={20} />
            <div>
              <b>{!status.reachable ? 'El panel no llega a ListPro' : 'ListPro no acepta el token del panel'}</b>
              <span className="small">{status.error ?? 'Revisa LISTPRO_API_URL y LISTPRO_ADMIN_TOKEN en Coolify.'}</span>
              {status.listproUrl && <span className="tiny muted">LISTPRO_API_URL = {status.listproUrl}</span>}
            </div>
          </div>
        )}
        {view === 'overview' && <Overview onToast={setToast} onGo={setView} />}
        {view === 'users' && <Users onToast={setToast} />}
        {view === 'settings' && <Settings onToast={setToast} />}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
