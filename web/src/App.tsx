import { useEffect, useState } from 'react';
import { LogOut, Moon, Settings as SettingsIcon, ShoppingBasket, Sun, Users as UsersIcon } from 'lucide-react';
import { api } from './api';
import type { Admin } from './types';
import { Login } from './screens/Login';
import { Users } from './screens/Users';
import { Settings } from './screens/Settings';

type View = 'users' | 'settings';

export function App() {
  const [admin, setAdmin] = useState<Admin | null | undefined>(undefined);
  const [view, setView] = useState<View>('users');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    api.me().then(setAdmin).catch(() => setAdmin(null));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
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

  return (
    <div className="admin">
      <header className="topbar">
        <a href="#/" className="brand" onClick={(e) => { e.preventDefault(); setView('users'); }} aria-label="ListPro Admin, inicio">
          <span className="brand-mark"><ShoppingBasket size={26} strokeWidth={2.2} /></span>
          <span className="brand-text">
            <span className="wordmark">List<em>Pro</em> <span className="admin-tag">Admin</span></span>
            <span className="tagline">Usuarios, planes e invitaciones</span>
          </span>
        </a>
        <div className="topbar-end">
          <nav className="nav" aria-label="Secciones">
            <button className={view === 'users' ? 'on' : ''} onClick={() => setView('users')}><UsersIcon size={18} /> Usuarios</button>
            <button className={view === 'settings' ? 'on' : ''} onClick={() => setView('settings')}><SettingsIcon size={18} /> Ajustes</button>
          </nav>
          <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Cambiar tema">
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button className="icon-btn" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <main className="page">
        {view === 'users' ? <Users onToast={setToast} /> : <Settings onToast={setToast} />}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
