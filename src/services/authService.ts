/**
 * Authentication (Supabase Auth). Login and sign-up go through the "auth-gate" Edge Function,
 * which counts bad attempts, blocks abusers and asks for a captcha. The browser only holds the
 * publishable key and the user's own session token. No password or hash is ever read or stored here.
 */
import { supabase, SUPABASE_CONFIG, SUPABASE_PUBLISHABLE_KEY } from './supabaseClient';
import type { Role, StoreTeamId, User, UserStatus } from '../types/inventory';
import { getPublicUserEmail, normalizeRole } from '../utils/security';

export class AuthGateError extends Error {
  code: string;
  retryAfterSeconds?: number;
  constructor(code: string, message: string, retryAfterSeconds?: number) {
    super(message);
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function callGate(body: Record<string, unknown>): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/auth-gate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthGateError('network', 'Unable to reach the server. Please check your connection and try again.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new AuthGateError(
      data?.error || 'error',
      data?.message || 'Something went wrong. Please try again.',
      data?.retryAfterSeconds
    );
  }
  return data;
}

export type LoginResult =
  | { status: 'active'; user: User }
  | { status: 'pending'; name: string }
  | { status: 'rejected'; message: string };

export async function signInWithGate(
  identifier: string,
  password: string,
  captchaToken?: string
): Promise<LoginResult> {
  const data = await callGate({ action: 'login', identifier, password, captchaToken });
  if (data.status === 'pending') return { status: 'pending', name: data.name || '' };
  if (data.status === 'rejected') return { status: 'rejected', message: data.message || '' };
  const s = data.session;
  if (!s?.access_token || !s?.refresh_token) {
    throw new AuthGateError('error', 'Login failed. Please try again.');
  }
  const { error } = await supabase.auth.setSession({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
  });
  if (error) throw new AuthGateError('error', error.message);
  const user = await loadSessionUser();
  if (!user) {
    await supabase.auth.signOut();
    throw new AuthGateError('error', 'Your account is not active yet.');
  }
  return { status: 'active', user };
}

export async function signUpWithGate(input: {
  name: string;
  email?: string;
  username?: string;
  phone?: string;
  password: string;
  requestedRole: Role;
  captchaToken?: string;
}): Promise<{ name: string; requestedRole: Role }> {
  const data = await callGate({ action: 'signup', ...input });
  return { name: data.name, requestedRole: data.requestedRole };
}

export async function signOutUser(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
}

export function buildUserFromRows(profile: any, teamRows: Array<{ team_id: string; role: string }>): User {
  const adminTeams = teamRows.filter((t) => t.role === 'team_admin').map((t) => t.team_id) as StoreTeamId[];
  const allTeams = Array.from(new Set(teamRows.map((t) => t.team_id))) as StoreTeamId[];
  return {
    id: profile.id,
    name: profile.full_name || 'Staff User',
    email: getPublicUserEmail(profile.email),
    username: profile.username || undefined,
    phone: profile.phone || undefined,
    role: normalizeRole(profile.role || profile.requested_role),
    status: (profile.status || 'active') as UserStatus,
    requestedRole: normalizeRole(profile.requested_role || profile.role),
    employeeId: profile.employee_id || undefined,
    avatarColor: profile.avatar_color || undefined,
    assignedTeams: allTeams,
    adminTeams,
    assignedFare2: Array.isArray(profile.assigned_fare2) ? profile.assigned_fare2.map(String) : [],
    createdAt: profile.created_at,
  };
}

/** The signed-in user from the live session, or null. Role and teams always come from the database. */
export async function loadSessionUser(): Promise<User | null> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess?.session?.user?.id;
  if (!uid) return null;
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error || !profile || profile.status !== 'active') return null;
  const { data: teamRows } = await supabase.from('user_teams').select('team_id, role').eq('user_id', uid);
  return buildUserFromRows(profile, teamRows || []);
}

/** Admin-only account actions (create / set password / delete) via the admin-users Edge Function. */
export async function callAdminUsers(body: Record<string, unknown>): Promise<any> {
  const send = async (token: string) => {
    const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/admin-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    return { res, data };
  };
  const { data: sess } = await supabase.auth.getSession();
  let token = sess?.session?.access_token;
  if (!token) throw new Error('You are signed out. Please sign in again.');
  let { res, data } = await send(token);
  if (res.status === 401) {
    // The saved token may be stale: get a fresh one and try once more.
    const { data: fresh } = await supabase.auth.refreshSession();
    const t2 = fresh?.session?.access_token;
    if (t2) ({ res, data } = await send(t2));
  }
  if (res.status === 401) {
    throw new Error('Your login session expired. Please log out, sign in again, then retry.');
  }
  if (!res.ok) throw new Error(data?.message || data?.error || 'Request failed');
  return data;
}
