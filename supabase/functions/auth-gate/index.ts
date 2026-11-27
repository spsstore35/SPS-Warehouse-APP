// Supabase Edge Function: auth-gate
//
// The ONLY door for login and sign-up. The browser never talks to the password system
// directly, so we can count bad attempts per IP and per account, block abusers, ask for a
// captcha, and write every suspicious attempt to the table public.security_events.
//
// Deploy with "Verify JWT" OFF (visitors are not signed in yet).
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Optional secret: TURNSTILE_SECRET_KEY (Cloudflare Turnstile). When set, a captcha is required
// for every sign-up and, after a few failed logins, for login too.

import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET_KEY') || '';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'; // set to https://sps-warehouse.vercel.app

// ---- limits (change here) ----
const WINDOW_MIN = 15;            // look-back window for failed logins
const MAX_FAIL_PER_ACCOUNT = 5;   // then that account is locked for the rest of the window
const MAX_FAIL_PER_IP = 20;       // then that IP is blocked for the rest of the window
const CAPTCHA_AFTER_FAIL = 3;     // per account (or 8 per IP): captcha needed on login
const SIGNUPS_PER_IP_HOUR = 3;
const SIGNUPS_PER_IP_DAY = 8;
const SIGNUPS_ALL_HOUR = 40;      // all visitors together

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

async function logEvent(kind: string, identifier: string | null, ip: string, detail: Record<string, unknown> = {}) {
  await admin.from('security_events').insert({ kind, identifier, ip, detail });
}

async function countSince(kind: string, minutes: number, filter: { identifier?: string; ip?: string }): Promise<number> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  let q = admin.from('security_events').select('id', { count: 'exact', head: true }).eq('kind', kind).gte('created_at', since);
  if (filter.identifier) q = q.eq('identifier', filter.identifier);
  if (filter.ip) q = q.eq('ip', filter.ip);
  const { count } = await q;
  return count || 0;
}

async function captchaOk(token: unknown, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true; // captcha not configured
  if (typeof token !== 'string' || !token) return false;
  const form = new URLSearchParams({ secret: TURNSTILE_SECRET, response: token });
  if (ip && ip !== 'unknown') form.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const data = await res.json();
    return Boolean(data?.success);
  } catch {
    return false;
  }
}

// ---- identifier helpers (same rules as the app) ----
function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase().replace(/\s+/g, '_');
}
function phoneVariants(raw: string): string[] {
  const compact = raw.trim().replace(/[\s\-().]/g, '');
  const digits = compact.replace(/\D/g, '');
  const set = new Set<string>();
  if (!digits || digits.length < 6) return [];
  set.add(compact); set.add(digits); set.add(`+${digits}`);
  if (digits.startsWith('01') && digits.length === 11) {
    set.add(`20${digits.slice(1)}`); set.add(`+20${digits.slice(1)}`); set.add(`0020${digits.slice(1)}`);
  }
  if (digits.startsWith('201') && digits.length === 12) {
    set.add(`0${digits.slice(2)}`); set.add(`+${digits}`); set.add(`00${digits}`);
  }
  if (digits.startsWith('00201') && digits.length === 14) {
    set.add(`0${digits.slice(4)}`); set.add(digits.slice(2)); set.add(`+${digits.slice(2)}`);
  }
  return [...set].filter((v) => v.length >= 4);
}
function normalizePhone(raw: string): string {
  const cleaned = raw.trim().replace(/[\s\-().]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0020') && digits.length >= 13) return `0${digits.slice(4)}`;
  if (digits.startsWith('20') && digits.length === 12) return `0${digits.slice(2)}`;
  return cleaned.startsWith('+') ? `+${digits}` : digits;
}

async function findProfile(identifier: string) {
  const id = identifier.trim();
  const cols = 'id, full_name, status, role';
  if (id.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) {
    const { data } = await admin.from('profiles').select(cols).ilike('email', id.toLowerCase()).limit(1).maybeSingle();
    if (data) return data;
  }
  const u = normalizeUsername(id);
  if (u && /^[a-z0-9._-]+$/.test(u)) {
    const { data } = await admin.from('profiles').select(cols).ilike('username', u).limit(1).maybeSingle();
    if (data) return data;
  }
  const variants = phoneVariants(id);
  if (variants.length) {
    const { data } = await admin.from('profiles').select(cols).in('phone', variants).limit(1);
    if (data && data.length) return data[0];
  }
  return null;
}

async function handleLogin(body: any, ip: string) {
  const identifier = typeof body.identifier === 'string' ? body.identifier.trim().slice(0, 200) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!identifier || !password || password.length > 200) {
    return json({ error: 'missing_fields', message: 'Please enter your email, phone number, or username and password.' }, 400);
  }
  const key = identifier.toLowerCase();

  const failsAccount = await countSince('login_failed', WINDOW_MIN, { identifier: key });
  const failsIp = await countSince('login_failed', WINDOW_MIN, { ip });
  if (failsAccount >= MAX_FAIL_PER_ACCOUNT || failsIp >= MAX_FAIL_PER_IP) {
    await logEvent('login_blocked', key, ip, { failsAccount, failsIp });
    return json(
      { error: 'blocked', message: `Too many failed attempts. Please wait ${WINDOW_MIN} minutes and try again.`, retryAfterSeconds: WINDOW_MIN * 60 },
      429,
    );
  }
  if (TURNSTILE_SECRET && (failsAccount >= CAPTCHA_AFTER_FAIL || failsIp >= 8)) {
    if (!(await captchaOk(body.captchaToken, ip))) {
      await logEvent('captcha_failed', key, ip, { where: 'login' });
      return json({ error: 'captcha_required', message: 'Please complete the check below to continue.' }, 403);
    }
  }

  const fail = async () => {
    await logEvent('login_failed', key, ip);
    return json({ error: 'invalid_credentials', message: 'Invalid credentials. Please check your login and password.' }, 401);
  };

  const profile = await findProfile(identifier);
  if (!profile) return await fail();

  const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
  const authEmail = authUser?.user?.email;
  if (!authEmail) return await fail();

  const { data, error } = await anon.auth.signInWithPassword({ email: authEmail, password });
  if (error || !data?.session) return await fail();

  // Password was right. Only now do we say anything about the account state.
  if (profile.status === 'pending') {
    return json({ status: 'pending', name: profile.full_name });
  }
  if (profile.status === 'rejected') {
    return json({ status: 'rejected', message: 'Your account request was declined by the administrator.' });
  }
  return json({
    status: 'active',
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
    },
  });
}

async function handleSignup(body: any, ip: string) {
  const perHour = await countSince('signup_attempt', 60, { ip });
  const perDay = await countSince('signup_attempt', 60 * 24, { ip });
  const allHour = await countSince('signup_attempt', 60, {});
  if (perHour >= SIGNUPS_PER_IP_HOUR || perDay >= SIGNUPS_PER_IP_DAY || allHour >= SIGNUPS_ALL_HOUR) {
    await logEvent('signup_blocked', null, ip, { perHour, perDay, allHour });
    return json({ error: 'blocked', message: 'Too many account requests. Please try again later.' }, 429);
  }
  if (TURNSTILE_SECRET && !(await captchaOk(body.captchaToken, ip))) {
    await logEvent('captcha_failed', null, ip, { where: 'signup' });
    return json({ error: 'captcha_required', message: 'Please complete the check below to continue.' }, 403);
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : '';
  const username = typeof body.username === 'string' ? normalizeUsername(body.username).slice(0, 40) : '';
  const phone = typeof body.phone === 'string' ? normalizePhone(body.phone).slice(0, 30) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const requested = ['worker', 'leader', 'admin'].includes(body.requestedRole) ? body.requestedRole : 'worker';

  await logEvent('signup_attempt', (email || username || phone || '').toLowerCase() || null, ip);

  if (!name) return json({ error: 'invalid', message: 'Please enter your full name' }, 400);
  if (!email && !username && !phone) return json({ error: 'invalid', message: 'Please enter at least one: Email, Username, or Phone Number.' }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid', message: 'Please enter a valid email address or leave Email empty.' }, 400);
  if (username && (username.length < 3 || !/^[a-z0-9._-]+$/.test(username))) return json({ error: 'invalid', message: 'Username must be at least 3 characters (letters, numbers, ".", "_", or "-").' }, 400);
  if (phone && phone.replace(/\D/g, '').length < 6) return json({ error: 'invalid', message: 'Please enter a valid phone number.' }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: 'invalid', message: 'Password must be at least 8 characters' }, 400);

  // duplicates
  if (email) {
    const { data } = await admin.from('profiles').select('id').ilike('email', email).limit(1);
    if (data?.length) return json({ error: 'duplicate', message: 'An account with this email already exists.' }, 409);
  }
  if (username) {
    const { data } = await admin.from('profiles').select('id').ilike('username', username).limit(1);
    if (data?.length) return json({ error: 'duplicate', message: 'An account with this username already exists.' }, 409);
  }
  if (phone) {
    const { data } = await admin.from('profiles').select('id').in('phone', phoneVariants(phone)).limit(1);
    if (data?.length) return json({ error: 'duplicate', message: 'An account with this phone number already exists.' }, 409);
  }

  const authEmail = email || `${crypto.randomUUID()}@noemail.sps.local`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  const id = created?.user?.id;
  if (createErr || !id) {
    return json({ error: 'create_failed', message: String(createErr?.message || '').includes('registered') ? 'An account with this email already exists.' : 'Could not create the account. Try a different password.' }, 400);
  }

  // The profile is ALWAYS created as 'worker' + 'pending': no access until a full_admin approves.
  // The role the person asked for is only a request.
  const { error: profErr } = await admin.from('profiles').insert({
    id,
    email: email || null,
    username: username || null,
    phone: phone || null,
    full_name: name,
    role: 'worker',
    status: 'pending',
    requested_role: requested,
    employee_id: `WH-REG-${Math.floor(100 + Math.random() * 900)}`,
    avatar_color: requested === 'leader' ? '#059669' : requested === 'admin' ? '#d97706' : '#0284c7',
  });
  if (profErr) {
    await admin.auth.admin.deleteUser(id);
    return json({ error: 'create_failed', message: 'Could not create the account. Please try again.' }, 400);
  }
  return json({ ok: true, name, requestedRole: requested });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const ip = clientIp(req);
  try {
    if (body?.action === 'login') return await handleLogin(body, ip);
    if (body?.action === 'signup') return await handleSignup(body, ip);
    return json({ error: 'unknown_action' }, 400);
  } catch (err) {
    console.error('auth-gate error', err);
    return json({ error: 'server_error', message: 'Something went wrong. Please try again.' }, 500);
  }
});
