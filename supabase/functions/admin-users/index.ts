// Supabase Edge Function: admin-users
//
// Account actions that need the service key. Only a signed-in, ACTIVE full_admin may call it.
// The service key lives only here (Supabase provides it to the function); it is never in the website.
//   create        -> new active account (+ team memberships)
//   set_password  -> set a new password for someone
//   delete        -> delete an account completely (never your own)
//
// Deploy with "Verify JWT" ON.

import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const TEAM_IDS = ['purchases', 'troops', 'inventory', 'calendar', 'marketing', 'budgeting'];
const ROLES = ['full_admin', 'admin', 'worker', 'leader'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return json({ error: 'unauthorized' }, 401);
  const { data: u, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !u?.user) return json({ error: 'unauthorized' }, 401);
  const callerId = u.user.id;
  const { data: caller } = await admin.from('profiles').select('role, status, full_name').eq('id', callerId).maybeSingle();
  if (!caller || caller.status !== 'active' || caller.role !== 'full_admin') {
    return json({ error: 'forbidden', message: 'Only a full_admin can do this.' }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  try {
    if (body.action === 'create') {
      const name = String(body.name || '').trim().slice(0, 120);
      const email = String(body.email || '').trim().toLowerCase();
      const username = String(body.username || '').trim().replace(/^@+/, '').toLowerCase().replace(/\s+/g, '_');
      const phone = String(body.phone || '').trim();
      const password = String(body.password || '');
      const role = String(body.role || 'worker');
      const teams: string[] = Array.isArray(body.teams) ? body.teams.filter((t: string) => TEAM_IDS.includes(t)) : [];
      if (!name || (!email && !username && !phone)) return json({ error: 'invalid', message: 'Name and at least one of email, username or phone are required.' }, 400);
      if (password.length < 8 || password.length > 128) return json({ error: 'invalid', message: 'Password must be at least 8 characters.' }, 400);
      if (!ROLES.includes(role)) return json({ error: 'invalid', message: 'Unknown role.' }, 400);

      for (const [col, val] of [['email', email], ['username', username], ['phone', phone]] as const) {
        if (!val) continue;
        const { data } = await admin.from('profiles').select('id').ilike(col, val).limit(1);
        if (data?.length) return json({ error: 'duplicate', message: `An account with this ${col} already exists.` }, 409);
      }

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: email || `${crypto.randomUUID()}@noemail.sps.local`, password, email_confirm: true, user_metadata: { full_name: name },
      });
      const id = created?.user?.id;
      if (cErr || !id) return json({ error: 'create_failed', message: cErr?.message || 'Could not create the account.' }, 400);
      const { error: pErr } = await admin.from('profiles').insert({
        id, email: email || null, username: username || null, phone: phone || null, full_name: name,
        role, status: 'active', requested_role: role,
        avatar_color: role === 'full_admin' ? '#b45309' : role === 'admin' ? '#d97706' : role === 'leader' ? '#059669' : '#0284c7',
        approved_at: new Date().toISOString(), approved_by_name: caller.full_name,
      });
      if (pErr) { await admin.auth.admin.deleteUser(id); return json({ error: 'create_failed', message: pErr.message }, 400); }
      if (teams.length && (role === 'admin' || role === 'worker')) {
        await admin.from('user_teams').insert(teams.map((t) => ({ user_id: id, team_id: t, role: role === 'admin' ? 'team_admin' : 'staff' })));
      }
      await admin.from('security_events').insert({ kind: 'admin_create_user', identifier: id, detail: { by: callerId, role } });
      return json({ ok: true, id });
    }

    if (body.action === 'set_password') {
      const userId = String(body.userId || '');
      const password = String(body.password || '');
      if (!userId) return json({ error: 'invalid' }, 400);
      if (password.length < 8 || password.length > 128) return json({ error: 'invalid', message: 'Password must be at least 8 characters.' }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: 'failed', message: error.message }, 400);
      await admin.from('security_events').insert({ kind: 'admin_set_password', identifier: userId, detail: { by: callerId } });
      return json({ ok: true });
    }

    if (body.action === 'delete') {
      const userId = String(body.userId || '');
      if (!userId) return json({ error: 'invalid' }, 400);
      if (userId === callerId) return json({ error: 'forbidden', message: 'You cannot delete your own account.' }, 403);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: 'failed', message: error.message }, 400);
      await admin.from('profiles').delete().eq('id', userId); // in case it was not linked
      await admin.from('security_events').insert({ kind: 'admin_delete_user', identifier: userId, detail: { by: callerId } });
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (err) {
    console.error('admin-users error', err);
    return json({ error: 'server_error' }, 500);
  }
});
