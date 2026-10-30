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
}

export interface Audit {
  id: number;
  action: string;
  target: string | null;
  details: string | null;
  at: string;
}
