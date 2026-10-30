import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShoppingBasket } from 'lucide-react';
import { api } from '../api';
import type { Admin } from '../types';

export function Login({ onLogin }: { onLogin: (a: Admin) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !email.includes('@') || !password) return;
    setBusy(true);
    setError(null);
    try {
      onLogin(await api.login(email, password));
    } catch (err) {
      setError((err as Error).message || 'No se pudo entrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark big"><ShoppingBasket size={38} strokeWidth={2.2} /></span>
          <span className="wordmark">List<em>Pro</em> <span className="admin-tag">Admin</span></span>
          <p className="muted">Panel de usuarios, planes e invitaciones.</p>
        </div>

        <form onSubmit={submit} className="form">
          <label className="field">
            Email
            <input className="input" type="email" autoComplete="username" autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
          </label>
          <label className="field">
            Contraseña
            <span className="pass">
              <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <button type="button" className="eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar contraseña' : 'Ver contraseña'}>
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary block" disabled={busy || !email.includes('@') || !password}>
            {busy ? 'Entrando…' : 'Entrar'} {!busy && <ArrowRight size={19} />}
          </button>
        </form>

        <p className="muted tiny center"><LockKeyhole size={13} /> Acceso solo para administradores</p>
      </div>
    </div>
  );
}
