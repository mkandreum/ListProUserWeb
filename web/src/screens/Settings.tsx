import { useEffect, useState } from 'react';
import { KeyRound, Mail, RefreshCw, Save, Send, ShieldCheck } from 'lucide-react';
import { AuditItem } from './Overview';
import { api } from '../api';
import type { Audit, Plan, Settings as SettingsType } from '../types';

export function Settings({ onToast }: { onToast: (s: string) => void }) {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [newUserPlan, setNewUserPlan] = useState<Plan>('pro');
  const [registrationMode, setRegistrationMode] = useState<'invite' | 'open'>('invite');
  const [smtp, setSmtp] = useState({ host: '', port: 587, user: '', pass: '', secure: false, from: '' });
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);

  const load = async () => {
    try {
      const s = await api.settings();
      setSettings(s);
      setNewUserPlan(s.newUserPlan);
      setRegistrationMode(s.registrationMode);
      setSmtp({
        host: s.smtp.host, port: s.smtp.port || 587, user: s.smtp.user,
        pass: '', secure: s.smtp.secure, from: s.smtp.from,
      });
      setTestTo(s.smtp.user || '');
      setAudit(await api.audit());
    } catch (e) {
      onToast((e as Error).message);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSettings = async () => {
    setBusy('settings');
    try {
      const s = await api.saveSettings({ newUserPlan, registrationMode });
      setSettings(s);
      onToast('Ajustes guardados');
    } catch (e) { onToast((e as Error).message); } finally { setBusy(null); }
  };

  const saveSmtp = async () => {
    setBusy('smtp');
    try {
      const body: Record<string, unknown> = {
        host: smtp.host, port: smtp.port, user: smtp.user, secure: smtp.secure, from: smtp.from,
      };
      if (smtp.pass.trim()) body.pass = smtp.pass;
      const s = await api.saveSmtp(body);
      setSettings((prev) => prev ? { ...prev, smtp: s } : prev);
      setSmtp((prev) => ({ ...prev, pass: '' }));
      onToast('SMTP guardado');
    } catch (e) { onToast((e as Error).message); } finally { setBusy(null); }
  };

  const test = async () => {
    setBusy('test');
    try {
      await api.testSmtp(testTo);
      onToast(`Correo de prueba enviado a ${testTo}`);
    } catch (e) { onToast((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <>
      <div className="row-head">
        <div>
          <h1 className="page-title">Ajustes</h1>
          <p className="muted">Altas nuevas, invitaciones y correo de ListPro.</p>
        </div>
        <button className="btn" onClick={load}><RefreshCw size={17} /> Recargar</button>
      </div>

      <section className="card panel">
        <h2><ShieldCheck size={20} /> Altas nuevas</h2>
        <p className="muted small">Solo afecta a las cuentas que se creen a partir de ahora. Los usuarios actuales no cambian.</p>

        <div className="setting-row">
          <div><b>Plan por defecto</b><span className="muted small">Lo que recibe un usuario nuevo al registrarse.</span></div>
          <div className="segmented" role="group" aria-label="Plan por defecto">
            <button aria-pressed={newUserPlan === 'pro'} onClick={() => setNewUserPlan('pro')}>Pro</button>
            <button aria-pressed={newUserPlan === 'free'} onClick={() => setNewUserPlan('free')}>Estándar</button>
          </div>
        </div>

        <div className="setting-row">
          <div><b>Registro</b><span className="muted small">Con invitación obligatoria o abierto a cualquiera.</span></div>
          <div className="segmented" role="group" aria-label="Modo de registro">
            <button aria-pressed={registrationMode === 'invite'} onClick={() => setRegistrationMode('invite')}>Con invitación</button>
            <button aria-pressed={registrationMode === 'open'} onClick={() => setRegistrationMode('open')}>Abierto</button>
          </div>
        </div>

        <button className="btn primary" disabled={busy === 'settings'} onClick={saveSettings}>
          <Save size={17} /> {busy === 'settings' ? 'Guardando…' : 'Guardar ajustes'}
        </button>
      </section>

      <section className="card panel">
        <h2><Mail size={20} /> SMTP</h2>
        <p className="muted small">
          Se guarda en ListPro y se usa para los correos de restablecer contraseña.
          {settings?.smtp.configured ? ' Configurado.' : ' Todavía sin configurar.'}
        </p>

        <div className="grid2">
          <label className="field">Servidor SMTP
            <input className="input" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.gmail.com" />
          </label>
          <label className="field">Puerto
            <input className="input" type="number" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) || 0 })} onBlur={() => !smtp.port && setSmtp({ ...smtp, port: smtp.secure ? 465 : 587 })} placeholder="587" />
          </label>
          <label className="field">Usuario
            <input className="input" value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} placeholder="usuario@dominio.com" autoComplete="off" />
          </label>
          <label className="field">Contraseña
            <input className="input" type="password" value={smtp.pass} onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
              placeholder={settings?.smtp.pass || '••••••••'} autoComplete="new-password" />
          </label>
          <label className="field">Remitente (From)
            <input className="input" value={smtp.from} onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} placeholder='"ListPro" <no-reply@listpro.xyoncloud.win>' />
          </label>
          <label className="check">
            <input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked, port: e.target.checked && smtp.port === 587 ? 465 : !e.target.checked && smtp.port === 465 ? 587 : smtp.port })} /> TLS/SSL directo (puerto 465)
          </label>
        </div>

        <div className="actions">
          <button className="btn primary" disabled={busy === 'smtp'} onClick={saveSmtp}><Save size={17} /> {busy === 'smtp' ? 'Guardando…' : 'Guardar SMTP'}</button>
        </div>

        <div className="test-row">
          <input className="input" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Email de prueba" />
          <button className="btn" disabled={busy === 'test' || !testTo.includes('@')} onClick={test}><Send size={17} /> {busy === 'test' ? 'Enviando…' : 'Probar correo'}</button>
        </div>
      </section>

      <section className="card panel">
        <h2><KeyRound size={20} /> Últimos cambios</h2>
        {!audit.length && <p className="muted small">Todavía no hay cambios registrados.</p>}
        {audit.length > 0 && (
          <ul className="audit">
            {audit.map((a) => <AuditItem key={a.id} a={a} />)}
          </ul>
        )}
      </section>
    </>
  );
}
