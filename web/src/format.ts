export const fmtDate = (iso: string | null | undefined) => iso
  ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

export const fmtDateTime = (iso: string | null | undefined) => iso
  ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

/** "hace 5 min", "hace 3 h", "hace 2 días" o la fecha si es antigua. */
export function relative(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} día${d > 1 ? 's' : ''}`;
  return fmtDate(iso);
}

const ACTIONS: Record<string, string> = {
  'user.plan': 'Plan cambiado',
  'user.invite': 'Invitación nueva',
  'user.reset': 'Correo de contraseña enviado',
  'user.logout': 'Sesiones cerradas',
  'user.delete': 'Cuenta borrada',
  'settings.update': 'Ajustes de altas',
  'smtp.update': 'SMTP guardado',
  'smtp.test': 'Correo de prueba',
  'catalog.refresh': 'Catálogo actualizado a mano',
};
export const actionLabel = (a: string) => ACTIONS[a] ?? a;
