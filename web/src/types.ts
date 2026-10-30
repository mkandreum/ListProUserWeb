export interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export type Plan = 'pro' | 'free';

export interface User {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  planStartedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  inviteCode: string | null;
  inviteUsedAt: string | null;
  invitedBy: string | null;
  listCode: string | null;
  store: string | null;
  lastSeenAt?: string | null;
}

/** Ficha completa: quién le invitó, a quién invitó y su lista. */
export interface UserDetail extends User {
  invitedByUser: { id: string; name: string; email: string } | null;
  invitees: { id: string; name: string; email: string; createdAt: string }[];
  list: {
    code: string;
    updatedAt: string;
    members: { id: string; name: string; hue: string }[];
    products: number;
    savedBaskets: number;
    expenses: number;
  } | null;
}

export interface CatalogStatus {
  id: string;
  name: string;
  hue: string;
  count: number;
  updatedAt: string | null;
  scraping: boolean;
}

export interface PanelStatus {
  listproUrl: string | null;
  reachable: boolean;
  tokenOk: boolean;
  error: string | null;
}

export interface Smtp {
  host: string;
  port: number;
  user: string;
  secure: boolean;
  from: string;
  configured: boolean;
  pass: string;
}

export interface Settings {
  newUserPlan: Plan;
  registrationMode: 'invite' | 'open';
  smtp: Smtp;
}

export interface Stats {
  total: number;
  pro: number;
  free: number;
  invitesUsed: number;
  invitesPending: number;
  smtpConfigured: boolean;
  // Las versiones antiguas de ListPro no los mandan
  active7?: number;
  active30?: number;
  signups?: { day: string; n: number }[];
  lists?: number;
  sharedLists?: number;
  catalogs?: CatalogStatus[];
}

export interface Audit {
  id: number;
  action: string;
  target: string | null;
  details: string | null;
  at: string;
  admin?: string | null;
}
