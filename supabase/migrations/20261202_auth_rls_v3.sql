-- ==============================================================================
-- SPS WAREHOUSE - AUTH + ROLES + ROW LEVEL SECURITY (v3)
-- ------------------------------------------------------------------------------
-- Run this file in the Supabase SQL Editor. It is safe to run more than once.
--
--   PART 1  (safe, run now)   Adds the new tables and functions and copies your
--                             existing accounts into Supabase Auth with the SAME
--                             passwords. The current live site keeps working.
--   PART 2  (the switch)      Locks the database (RLS). It REFUSES to run until you
--                             flip the switch on purpose (see "SWITCH" below).
--
-- Role names in the database (unchanged on purpose, so nothing breaks):
--     full_admin = full_admin        admin  = team_admin        worker = staff
--     leader     = leader (read only, never sees quantities)
-- ==============================================================================

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.app_settings (key text primary key, value text not null);

-- ==============================================================================
-- PART 1: SAFE PREPARATION
-- ==============================================================================

-- 1.1 Teams -------------------------------------------------------------------
create table if not exists public.teams (
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);
insert into public.teams (id, name) values
  ('purchases', 'Purchases'),
  ('troops',    'Troops / Scouts'),
  ('inventory', 'Inventory Management'),
  ('calendar',  'Calendar'),
  ('marketing', 'Marketing'),
  ('budgeting', 'Budgeting')
on conflict (id) do nothing;

-- 1.2 user_teams: one user can be in MANY teams, with a role in each team --------
create table if not exists public.user_teams (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  team_id    text not null references public.teams(id) on delete cascade,
  role       text not null check (role in ('team_admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);
create index if not exists user_teams_team_idx on public.user_teams (team_id);

-- 1.3 Log of suspicious attempts (only a full_admin can read it) ----------------
create table if not exists public.security_events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind       text not null,     -- login_failed, login_blocked, signup_attempt, signup_blocked, captcha_failed ...
  identifier text,              -- email / username / phone that was typed (lowercased)
  ip         text,
  detail     jsonb not null default '{}'::jsonb
);
create index if not exists security_events_lookup_idx on public.security_events (kind, created_at desc);
create index if not exists security_events_ip_idx on public.security_events (ip, created_at desc);
create index if not exists security_events_ident_idx on public.security_events (identifier, created_at desc);

-- 1.4 Helper functions used by every policy ------------------------------------
-- They read profiles / user_teams as the function owner, so policies on those two
-- tables cannot loop on themselves.
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select p.role::text from public.profiles p where p.id = auth.uid() and p.status::text = 'active'
$$;

create or replace function public.app_is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.status::text = 'active')
$$;

create or replace function public.app_is_full_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'full_admin', false)
$$;

create or replace function public.app_is_leader() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'leader', false)
$$;

-- Active user who is NOT a leader (staff, team_admin or full_admin).
create or replace function public.app_is_staff_or_above() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('worker', 'admin', 'full_admin'), false)
$$;

-- Member (any role) of at least one of these teams. full_admin counts as member of all.
create or replace function public.app_member_of_any(p_teams text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_is_full_admin()
      or exists (
           select 1
           from public.user_teams ut
           where ut.user_id = auth.uid()
             and ut.team_id = any (p_teams)
             and public.app_role() in ('worker', 'admin')
         )
$$;

-- >>> THE APPROVAL RULE LIVES HERE <<<
-- true for a full_admin (every team) or for a team_admin of THAT team, via user_teams.
-- There is deliberately NO check that the approver differs from the requester, so
-- a full_admin / team_admin MAY approve their own request. Staff and leaders: never.
create or replace function public.app_is_team_admin(p_team text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_is_full_admin()
      or (
           public.app_role() = 'admin'
           and exists (
             select 1 from public.user_teams ut
             where ut.user_id = auth.uid() and ut.team_id = p_team and ut.role = 'team_admin'
           )
         )
$$;

create or replace function public.app_admin_of_any(p_teams text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_is_full_admin()
      or (
           public.app_role() = 'admin'
           and exists (
             select 1 from public.user_teams ut
             where ut.user_id = auth.uid() and ut.team_id = any (p_teams) and ut.role = 'team_admin'
           )
         )
$$;

-- Is the caller a team_admin of ANY team (or full_admin)?
create or replace function public.app_is_any_team_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_is_full_admin()
      or (
           public.app_role() = 'admin'
           and exists (select 1 from public.user_teams ut where ut.user_id = auth.uid() and ut.role = 'team_admin')
         )
$$;

revoke all on function public.app_role(), public.app_is_active(), public.app_is_full_admin(),
  public.app_is_leader(), public.app_is_staff_or_above(), public.app_member_of_any(text[]),
  public.app_is_team_admin(text), public.app_admin_of_any(text[]), public.app_is_any_team_admin()
  from public, anon;
grant execute on function public.app_role(), public.app_is_active(), public.app_is_full_admin(),
  public.app_is_leader(), public.app_is_staff_or_above(), public.app_member_of_any(text[]),
  public.app_is_team_admin(text), public.app_admin_of_any(text[]), public.app_is_any_team_admin()
  to authenticated;

-- 1.4b Team admin RPCs used by the site. ONLY a full_admin can call them, and never on
-- their own account. (Second place where "only full_admin changes roles/teams" lives; the
-- first is the guard_profile_update trigger and the user_teams policies in Part 2.)
create or replace function public.admin_set_user_teams(p_user uuid, p_teams text[], p_fare2 text[] default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if not public.app_is_full_admin() then raise exception 'Only a full_admin can change teams.' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'Nobody can change their own teams.' using errcode = '42501'; end if;
  select role::text into v_role from public.profiles where id = p_user;
  if v_role is null then raise exception 'Unknown user'; end if;
  if v_role in ('admin', 'worker') then
    delete from public.user_teams where user_id = p_user and not (team_id = any (coalesce(p_teams, '{}')));
    insert into public.user_teams (user_id, team_id, role)
    select p_user, t, case when v_role = 'admin' then 'team_admin' else 'staff' end
    from unnest(coalesce(p_teams, '{}')) t where t in (select id from public.teams)
    on conflict (user_id, team_id) do nothing;   -- keep a role that was already set per team
  else
    delete from public.user_teams where user_id = p_user;
  end if;
  if p_fare2 is not null then
    update public.profiles set assigned_fare2 = to_jsonb(p_fare2) where id = p_user;
  end if;
end $$;

create or replace function public.admin_set_team_role(p_user uuid, p_team text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.app_is_full_admin() then raise exception 'Only a full_admin can change team roles.' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'Nobody can change their own team role.' using errcode = '42501'; end if;
  if p_role not in ('team_admin', 'staff') then raise exception 'Role must be team_admin or staff'; end if;
  update public.user_teams set role = p_role where user_id = p_user and team_id = p_team;
  if not found then raise exception 'That user is not in that team'; end if;
end $$;
revoke all on function public.admin_set_user_teams(uuid, text[], text[]), public.admin_set_team_role(uuid, text, text) from public, anon;
grant execute on function public.admin_set_user_teams(uuid, text[], text[]), public.admin_set_team_role(uuid, text, text) to authenticated;

-- 1.4c Checked stock changes. The app changes stock in 3 places: (a) an order takes stock when the
-- deposit is confirmed, (b) goods arriving from a purchase/production batch are added, (c) an
-- inventory admin adjusts. (a) and (b) are done by admins of OTHER teams (budgeting, troops,
-- purchases), who must not edit product_variants directly. This function lets them do ONLY these
-- two things, with checks, and writes the audit row. Delivery/handover does not change stock.
create or replace function public.apply_stock_change(p_variant_id text, p_delta integer, p_kind text, p_ref text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_new integer; v_ok boolean := false; v_allowed integer;
begin
  if not public.app_is_staff_or_above() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'Nothing to change.'; end if;
  if p_kind = 'order_deduction' then
    -- caller is a full_admin or team_admin of budgeting / troops / inventory, delta is negative,
    -- and the order really contains that variant with at least that quantity.
    if p_delta > 0 or not public.app_admin_of_any(array['budgeting','troops','inventory']) then
      raise exception 'Only an admin of the orders team can take stock for an order.' using errcode = '42501';
    end if;
    -- If the order's items are already saved, the amount must fit them. (A brand-new order is
    -- saved a moment AFTER its stock is taken, so with no items yet we accept it.)
    if exists (select 1 from public.booking_items where booking_id = p_ref) then
      select coalesce(sum(quantity), 0) into v_allowed from public.booking_items where booking_id = p_ref and variant_id = p_variant_id;
      if v_allowed < -p_delta then raise exception 'That order does not contain that much of this item.' using errcode = '42501'; end if;
    end if;
    v_ok := true;
  elsif p_kind = 'batch_stock_in' then
    if p_delta < 0 or not public.app_admin_of_any(array['purchases','inventory']) then
      raise exception 'Only an admin of the purchases team can add received stock.' using errcode = '42501';
    end if;
    if to_regclass('public.production_batches') is null
       or not exists (select 1 from public.production_batches where id = p_ref) then
      raise exception 'Unknown purchase/production batch.' using errcode = '42501';
    end if;
    v_ok := true;
  elsif p_kind = 'inventory_adjust' then
    if not public.app_admin_of_any(array['inventory']) then
      raise exception 'Only inventory admins can adjust stock.' using errcode = '42501';
    end if;
    v_ok := true;
  end if;
  if not v_ok then raise exception 'Unknown stock change type.'; end if;
  perform set_config('app.stock_fn', 'on', true);
  update public.product_variants set quantity = greatest(0, quantity + p_delta), updated_at = now()
   where id = p_variant_id returning quantity into v_new;
  perform set_config('app.stock_fn', 'off', true);
  if v_new is null then raise exception 'Unknown item.'; end if;
  return v_new;
end $$;
revoke all on function public.apply_stock_change(text, integer, text, text) from public, anon;
grant execute on function public.apply_stock_change(text, integer, text, text) to authenticated;

-- 1.5 Copy existing accounts into Supabase Auth ---------------------------------
-- Same id as the profile, same email (or a made-up @noemail.sps.local one), and the
-- SAME bcrypt password hash, so everybody logs in with the password they already have.
--   * plain-text passwords are hashed;
--   * old SHA-256 passwords cannot be converted: that user gets a random password and
--     is listed in the result so a full_admin can set a new one;
--   * the sample password "CHANGE_ME_INITIAL_ADMIN_PASSWORD" is always blocked.
create or replace function private.sync_profiles_to_auth(p_refresh boolean default false)
returns table (profile_id uuid, who text, note text)
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  r        record;
  v_email  text;
  v_hash   text;
  v_note   text;
  v_raw    text;
begin
  for r in
    select p.*, to_jsonb(p) as j
    from public.profiles p
    where not exists (select 1 from auth.users u where u.id = p.id)
  loop
    v_raw   := coalesce(nullif(r.j->>'password_hash', ''), nullif(r.j->>'password_plain', ''));
    v_email := nullif(lower(btrim(coalesce(r.email, ''))), '');
    if v_email is null or exists (select 1 from auth.users u where lower(u.email) = v_email) then
      v_email := r.id::text || '@noemail.sps.local';
    end if;
    v_note := null;

    if v_raw is null then
      v_hash := crypt(gen_random_uuid()::text, gen_salt('bf', 10));
      v_note := 'no password stored: set a new password';
    elsif v_raw ~ '^\$2[aby]\$' then
      v_hash := regexp_replace(v_raw, '^\$2y\$', '$2a$');
      if crypt('CHANGE_ME_INITIAL_ADMIN_PASSWORD', v_hash) = v_hash then
        v_hash := crypt(gen_random_uuid()::text, gen_salt('bf', 10));
        v_note := 'sample seed password was blocked: set a new password';
      end if;
    elsif v_raw ~ '^(\$sha256\$)?[0-9a-fA-F]{64}$' then
      v_hash := crypt(gen_random_uuid()::text, gen_salt('bf', 10));
      v_note := 'old SHA-256 password cannot be converted: set a new password';
    else
      v_hash := crypt(v_raw, gen_salt('bf', 10));   -- it was stored as plain text
      if v_raw = 'CHANGE_ME_INITIAL_ADMIN_PASSWORD' then
        v_hash := crypt(gen_random_uuid()::text, gen_salt('bf', 10));
        v_note := 'sample seed password was blocked: set a new password';
      end if;
    end if;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated',
      v_email, v_hash, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', r.full_name),
      coalesce(r.created_at, now()), now(), '', '', '', ''
    );

    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), r.id,
      jsonb_build_object('sub', r.id::text, 'email', v_email, 'email_verified', true),
      'email', r.id::text, null, now(), now()
    );

    profile_id := r.id;
    who  := coalesce(r.username, r.email, r.phone, r.full_name);
    note := coalesce(v_note, 'copied with the existing password');
    return next;
  end loop;

  -- Before the switch, passwords changed on the OLD site are carried over too.
  if p_refresh then
    update auth.users u
       set encrypted_password = regexp_replace(p.password_hash, '^\$2y\$', '$2a$'),
           updated_at = now()
      from public.profiles p
     where p.id = u.id
       and p.password_hash ~ '^\$2[aby]\$'
       and regexp_replace(p.password_hash, '^\$2y\$', '$2a$') <> u.encrypted_password
       and crypt('CHANGE_ME_INITIAL_ADMIN_PASSWORD', p.password_hash) <> p.password_hash;
  end if;
end $$;
revoke all on function private.sync_profiles_to_auth(boolean) from public, anon, authenticated;

-- Copy old assigned_teams (JSON list) into user_teams. Old role admin => team_admin,
-- old role worker => staff. Re-running it never removes anything.
drop function if exists private.sync_user_teams_from_profiles();
create or replace function private.sync_user_teams_from_profiles(p_reset boolean default false) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_reset then
    -- First time only, at the switch: the OLD site was the source of truth until now.
    delete from public.user_teams ut using public.profiles p
     where p.id = ut.user_id
       and not (case when jsonb_typeof(p.assigned_teams) = 'array' then p.assigned_teams else '[]'::jsonb end) ? ut.team_id;
    update public.user_teams ut
       set role = case when p.role::text = 'admin' then 'team_admin' else 'staff' end
      from public.profiles p where p.id = ut.user_id and p.role::text in ('admin', 'worker');
  end if;
  insert into public.user_teams (user_id, team_id, role)
  select p.id, t.value,
         case when p.role::text = 'admin' then 'team_admin' else 'staff' end
  from public.profiles p
  cross join lateral jsonb_array_elements_text(
     case when jsonb_typeof(p.assigned_teams) = 'array' then p.assigned_teams else '[]'::jsonb end
  ) as t(value)
  where p.role::text in ('admin', 'worker')
    and t.value in (select id from public.teams)
  on conflict (user_id, team_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.sync_user_teams_from_profiles(boolean) from public, anon, authenticated;

-- Run them now. The two result tables show what happened.
select * from private.sync_profiles_to_auth(true);
select private.sync_user_teams_from_profiles() as team_memberships_copied;

-- 1.6 Helper for the FIRST full_admin -------------------------------------------
-- Promote an EXISTING account (email, username or phone, exactly as stored):
--     select private.make_full_admin('the-email-or-username-or-phone');
create or replace function private.make_full_admin(p_identifier text) returns text
language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid; v_n integer;
begin
  select count(*), min(p.id::text)::uuid into v_n, v_id from public.profiles p
   where lower(p.email) = lower(btrim(p_identifier))
      or lower(p.username) = lower(regexp_replace(btrim(p_identifier), '^@+', ''))
      or p.phone = btrim(p_identifier);
  if v_n = 0 or v_id is null then raise exception 'No account matches "%"', p_identifier; end if;
  if v_n > 1 then raise exception 'More than one account matches "%"', p_identifier; end if;
  perform * from private.sync_profiles_to_auth(false);
  update public.profiles set role = 'full_admin', requested_role = 'full_admin', status = 'active',
         approved_at = coalesce(approved_at, now()), approved_by_name = coalesce(approved_by_name, 'SQL editor')
   where id = v_id;
  return 'OK: ' || v_id::text || ' is now an active full_admin';
end $$;
revoke all on function private.make_full_admin(text) from public, anon, authenticated;

-- Fallback when you have NO account yet (type your own strong password; the SQL
-- editor history may keep it, so change it after the first login):
--     select private.create_first_admin('you@example.com', 'A-long-password-here', 'Your Name');
create or replace function private.create_first_admin(p_email text, p_password text, p_name text) returns text
language plpgsql security definer set search_path = public, auth, extensions as $$
declare v_id uuid := gen_random_uuid();
begin
  if length(coalesce(p_password, '')) < 12 then raise exception 'Use a password of at least 12 characters'; end if;
  if exists (select 1 from auth.users where lower(email) = lower(p_email)) then raise exception 'Email already exists'; end if;
  insert into public.profiles (id, email, full_name, role, status, requested_role, approved_at, approved_by_name)
  values (v_id, lower(p_email), p_name, 'full_admin', 'active', 'full_admin', now(), 'SQL editor');
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', lower(p_email),
    crypt(p_password, gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', p_name), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, jsonb_build_object('sub', v_id::text, 'email', lower(p_email), 'email_verified', true),
    'email', v_id::text, null, now(), now());
  return 'OK: created full_admin ' || lower(p_email);
end $$;
revoke all on function private.create_first_admin(text, text, text) from public, anon, authenticated;

-- ==============================================================================
-- >>> STOP HERE FOR NOW. Everything above is Part 1 and is safe. <<<
-- Before Part 2: deploy the new site preview, log in with real accounts, deploy the
-- Edge Functions (see docs/AUTH_RLS_SETUP.md). Then do the SWITCH.
--
-- SWITCH (run this ONE statement only when you are ready to go live):
--     insert into private.app_settings (key, value) values ('allow_lockdown', 'yes')
--       on conflict (key) do update set value = 'yes';
-- Then run this whole file again. After it finishes it sets the switch back to 'no'.
-- ==============================================================================

-- ==============================================================================
-- PART 2: THE SWITCH (RLS lock-down). Refuses to run until the switch is 'yes'.
-- ==============================================================================
do $part2$
declare
  v_allow text;
  v_admins integer;
  v_missing integer;
  t record;
  pol record;
begin
  select value into v_allow from private.app_settings where key = 'allow_lockdown';
  if coalesce(v_allow, 'no') <> 'yes' then
    raise notice 'PART 2 SKIPPED: switch is not on. This is normal for a first run.';
    return;
  end if;

  -- 2.0 Safety checks: nobody may be locked out ---------------------------------
  perform * from private.sync_profiles_to_auth(true);
  perform private.sync_user_teams_from_profiles(not exists (select 1 from private.app_settings where key = 'lockdown_done'));

  select count(*) into v_missing
    from public.profiles p where not exists (select 1 from auth.users u where u.id = p.id);
  if v_missing > 0 then
    raise exception 'ABORT: % profiles still have no login account.', v_missing;
  end if;

  select count(*) into v_admins
    from public.profiles p join auth.users u on u.id = p.id
   where p.role::text = 'full_admin' and p.status::text = 'active';
  if v_admins < 1 then
    raise exception 'ABORT: there is no active full_admin. Run: select private.make_full_admin(''your-email-or-username'');';
  end if;

  -- 2.1 Keep the old password hashes in a private table (for rollback), then wipe them
  create table if not exists private.legacy_password_hashes (
    profile_id uuid primary key, password_hash text, password_plain text, saved_at timestamptz default now());
  insert into private.legacy_password_hashes (profile_id, password_hash, password_plain)
  select p.id, to_jsonb(p)->>'password_hash', to_jsonb(p)->>'password_plain' from public.profiles p
  on conflict (profile_id) do nothing;
  update public.profiles set password_hash = null where password_hash is not null;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='password_plain') then
    execute 'update public.profiles set password_plain = null where password_plain is not null';
  end if;

  -- 2.2 Every profile IS an auth user from now on --------------------------------
  alter table public.profiles drop constraint if exists profiles_id_auth_fkey;
  alter table public.profiles add constraint profiles_id_auth_fkey
    foreign key (id) references auth.users (id) on delete cascade;

  -- 2.3 Remove ALL old open policies, turn RLS on for EVERY table (default deny) ---
  for pol in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on public.%I from anon', t.tablename);
    execute format('revoke all on public.%I from authenticated', t.tablename);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.tablename);
  end loop;
  -- Never let a client read the abuse log directly through an API grant except via RLS below.
  revoke all on all sequences in schema public from anon;
  drop function if exists public.login_lookup_profile(text);
  if to_regprocedure('public.register_push_subscription(text,jsonb,text)') is not null then
    revoke execute on function public.register_push_subscription(text, jsonb, text) from anon, public;
    grant execute on function public.register_push_subscription(text, jsonb, text) to authenticated;
  end if;

  raise notice 'PART 2: structure ready, creating policies...';
end
$part2$;

-- The policies below are created only when the switch is on (they are inside DO blocks).
do $policies$
declare
  v_allow text;
begin
  select value into v_allow from private.app_settings where key = 'allow_lockdown';
  if coalesce(v_allow, 'no') <> 'yes' then return; end if;

  ------------------------------------------------------------------------------
  -- profiles: you see yourself; a full_admin sees everyone; staff / team_admins
  -- see ACTIVE colleagues (names for dropdowns). Leaders see only themselves.
  ------------------------------------------------------------------------------
  create policy profiles_select on public.profiles for select to authenticated
    using (
      id = auth.uid()
      or public.app_is_full_admin()
      or (public.app_is_staff_or_above() and status::text = 'active')
      or (public.app_is_any_team_admin() and status::text = 'pending')
    );
  -- No INSERT policy: accounts are created only by the Edge Functions (service role).
  create policy profiles_update on public.profiles for update to authenticated
    using (id = auth.uid() or public.app_is_full_admin())
    with check (id = auth.uid() or public.app_is_full_admin());
  -- No DELETE policy: deleting an account goes through the admin-users Edge Function.

  ------------------------------------------------------------------------------
  -- teams / user_teams. Only a full_admin changes memberships, never your own.
  ------------------------------------------------------------------------------
  create policy teams_select on public.teams for select to authenticated using (public.app_is_active());
  create policy teams_write on public.teams for all to authenticated
    using (public.app_is_full_admin()) with check (public.app_is_full_admin());

  create policy user_teams_select on public.user_teams for select to authenticated
    using (user_id = auth.uid() or public.app_is_full_admin() or public.app_admin_of_any(array[team_id]));
  create policy user_teams_insert on public.user_teams for insert to authenticated
    with check (public.app_is_full_admin() and user_id <> auth.uid());
  create policy user_teams_update on public.user_teams for update to authenticated
    using (public.app_is_full_admin() and user_id <> auth.uid())
    with check (public.app_is_full_admin() and user_id <> auth.uid());
  create policy user_teams_delete on public.user_teams for delete to authenticated
    using (public.app_is_full_admin() and user_id <> auth.uid());

  create policy security_events_select on public.security_events for select to authenticated
    using (public.app_is_full_admin());
  -- no insert policy: only Edge Functions (service role) write to it.

  ------------------------------------------------------------------------------
  -- Reference data everybody active can read (leaders too).
  ------------------------------------------------------------------------------
  if to_regclass('public.categories') is not null then
    create policy categories_select on public.categories for select to authenticated using (public.app_is_active());
    create policy categories_write on public.categories for all to authenticated
      using (public.app_admin_of_any(array['inventory'])) with check (public.app_admin_of_any(array['inventory']));
  end if;
  if to_regclass('public.target_audiences') is not null then
    create policy target_audiences_select on public.target_audiences for select to authenticated using (public.app_is_active());
    create policy target_audiences_write on public.target_audiences for all to authenticated
      using (public.app_admin_of_any(array['inventory'])) with check (public.app_admin_of_any(array['inventory']));
  end if;
  if to_regclass('public.others_folders') is not null then
    create policy others_folders_select on public.others_folders for select to authenticated using (public.app_is_active());
    create policy others_folders_write on public.others_folders for all to authenticated
      using (public.app_admin_of_any(array['inventory','marketing'])) with check (public.app_admin_of_any(array['inventory','marketing']));
  end if;

  ------------------------------------------------------------------------------
  -- products: everyone active reads (leaders only ACTIVE ones, with prices).
  -- Staff can only INSERT with status 'pending'. Edit/delete: inventory admins.
  -- Marketing members may edit photos/colors (see guard trigger below).
  ------------------------------------------------------------------------------
  create policy products_select on public.products for select to authenticated
    using (
      public.app_is_active()
      and (not public.app_is_leader() or coalesce(to_jsonb(products)->>'status', 'active') = 'active')
    );
  create policy products_insert on public.products for insert to authenticated
    with check (
      public.app_admin_of_any(array['inventory'])
      or (public.app_is_staff_or_above() and coalesce(to_jsonb(products)->>'status', 'pending') = 'pending')
    );
  create policy products_update on public.products for update to authenticated
    using (public.app_admin_of_any(array['inventory']) or public.app_member_of_any(array['marketing']))
    with check (public.app_admin_of_any(array['inventory']) or public.app_member_of_any(array['marketing']));
  create policy products_delete on public.products for delete to authenticated
    using (public.app_admin_of_any(array['inventory']));

  ------------------------------------------------------------------------------
  -- product_variants holds the QUANTITIES. Leaders get NO access to this table at
  -- all: they read the view leader_product_variants (no quantity columns).
  ------------------------------------------------------------------------------
  create policy variants_select on public.product_variants for select to authenticated
    using (public.app_is_staff_or_above());
  create policy variants_insert on public.product_variants for insert to authenticated
    with check (
      public.app_admin_of_any(array['inventory'])
      or (public.app_is_staff_or_above() and exists (
            select 1 from public.products p
             where p.id = product_variants.product_id and coalesce(to_jsonb(p)->>'status', '') = 'pending'))
    );
  create policy variants_update on public.product_variants for update to authenticated
    using (public.app_admin_of_any(array['inventory']) or public.app_member_of_any(array['marketing']))
    with check (public.app_admin_of_any(array['inventory']) or public.app_member_of_any(array['marketing']));
  create policy variants_delete on public.product_variants for delete to authenticated
    using (public.app_admin_of_any(array['inventory']));

  ------------------------------------------------------------------------------
  -- Approval queues. Staff INSERT (as themselves, status pending). Only a full_admin
  -- or the team_admin OF THAT TEAM can decide. Self-approval by admins is allowed.
  ------------------------------------------------------------------------------
  create policy adj_select on public.adjustment_requests for select to authenticated
    using (worker_id = auth.uid()::text or public.app_admin_of_any(array['inventory']));
  create policy adj_insert on public.adjustment_requests for insert to authenticated
    with check (
      public.app_is_staff_or_above()
      and worker_id = auth.uid()::text
      and (status::text = 'pending' or public.app_is_team_admin('inventory'))
    );
  create policy adj_update on public.adjustment_requests for update to authenticated
    using (public.app_is_team_admin('inventory')) with check (public.app_is_team_admin('inventory'));
  create policy adj_delete on public.adjustment_requests for delete to authenticated
    using (public.app_is_full_admin());

  create policy tcr_select on public.team_change_requests for select to authenticated
    using (requested_by_id = auth.uid()::text or public.app_is_team_admin(team_scope));
  create policy tcr_insert on public.team_change_requests for insert to authenticated
    with check (
      public.app_is_staff_or_above()
      and requested_by_id = auth.uid()::text
      and public.app_member_of_any(array[team_scope])
      and (status = 'pending' or public.app_is_team_admin(team_scope))
    );
  create policy tcr_update on public.team_change_requests for update to authenticated
    using (public.app_is_team_admin(team_scope)) with check (public.app_is_team_admin(team_scope));
  create policy tcr_delete on public.team_change_requests for delete to authenticated
    using (public.app_is_full_admin());

  ------------------------------------------------------------------------------
  -- Audit log: append only. Staff and above may add rows; admins read.
  ------------------------------------------------------------------------------
  create policy audit_select on public.stock_audit_logs for select to authenticated
    using (public.app_is_any_team_admin());
  create policy audit_insert on public.stock_audit_logs for insert to authenticated
    with check (public.app_is_staff_or_above());

  ------------------------------------------------------------------------------
  -- Bookings (troops + budgeting teams). Staff create their own and may only
  -- touch the "request a deposit change / ask payment check" fields (guard trigger).
  ------------------------------------------------------------------------------
  create policy bookings_select on public.bookings for select to authenticated
    using (public.app_member_of_any(array['troops','budgeting','inventory']));
  -- Orders belong to Scout Fera2 ('troops'). Only a full_admin or the team_admin of that team
  -- creates / edits / deletes orders (staff of the team send a request, an admin approves).
  -- Budgeting can read orders; its team_admin can confirm payments (guard trigger below).
  create policy bookings_insert on public.bookings for insert to authenticated
    with check (public.app_admin_of_any(array['troops']));
  create policy bookings_update on public.bookings for update to authenticated
    using (public.app_member_of_any(array['troops','budgeting','inventory']))
    with check (public.app_member_of_any(array['troops','budgeting','inventory']));
  create policy bookings_delete on public.bookings for delete to authenticated
    using (public.app_admin_of_any(array['troops']));
  create policy booking_items_select on public.booking_items for select to authenticated
    using (public.app_member_of_any(array['troops','budgeting','inventory']));
  create policy booking_items_write on public.booking_items for all to authenticated
    using (public.app_admin_of_any(array['troops']))
    with check (public.app_admin_of_any(array['troops']));
  ------------------------------------------------------------------------------
  -- Calendar
  ------------------------------------------------------------------------------
  create policy cal_select on public.calendar_events for select to authenticated
    using (public.app_is_staff_or_above());
  create policy cal_insert on public.calendar_events for insert to authenticated
    with check (
      public.app_is_any_team_admin()
      or (public.app_is_staff_or_above() and created_by_id = auth.uid()::text)
    );
  create policy cal_update on public.calendar_events for update to authenticated
    using (
      public.app_is_any_team_admin()
      or created_by_id = auth.uid()::text or assigned_to_id = auth.uid()::text
    )
    with check (
      public.app_is_any_team_admin()
      or created_by_id = auth.uid()::text or assigned_to_id = auth.uid()::text
    );
  create policy cal_delete on public.calendar_events for delete to authenticated
    using (public.app_is_any_team_admin() or created_by_id = auth.uid()::text);

  if to_regclass('public.scout_seasons') is not null then
    create policy scout_seasons_select on public.scout_seasons for select to authenticated using (public.app_is_staff_or_above());
    create policy scout_seasons_write on public.scout_seasons for all to authenticated
      using (public.app_admin_of_any(array['calendar'])) with check (public.app_admin_of_any(array['calendar']));
  end if;
  if to_regclass('public.scout_fera2_leaders') is not null then
    create policy fera2_select on public.scout_fera2_leaders for select to authenticated using (public.app_is_staff_or_above());
    create policy fera2_write on public.scout_fera2_leaders for all to authenticated
      using (public.app_is_full_admin()) with check (public.app_is_full_admin());
  end if;

  ------------------------------------------------------------------------------
  -- Marketing
  ------------------------------------------------------------------------------
  if to_regclass('public.marketing_offers') is not null then
    create policy offers_select on public.marketing_offers for select to authenticated using (public.app_is_staff_or_above());
    create policy offers_write on public.marketing_offers for all to authenticated
      using (public.app_admin_of_any(array['marketing'])) with check (public.app_admin_of_any(array['marketing']));
  end if;

  ------------------------------------------------------------------------------
  -- Purchases / sourcing
  ------------------------------------------------------------------------------
  if to_regclass('public.vendors') is not null then
    create policy vendors_select on public.vendors for select to authenticated using (public.app_member_of_any(array['purchases','budgeting']));
    create policy vendors_write on public.vendors for all to authenticated
      using (public.app_admin_of_any(array['purchases'])) with check (public.app_admin_of_any(array['purchases']));
  end if;
  if to_regclass('public.vendor_price_history') is not null then
    create policy vph_select on public.vendor_price_history for select to authenticated using (public.app_member_of_any(array['purchases','budgeting']));
    create policy vph_write on public.vendor_price_history for all to authenticated
      using (public.app_admin_of_any(array['purchases'])) with check (public.app_admin_of_any(array['purchases']));
  end if;
  if to_regclass('public.product_stage_vendors') is not null then
    create policy psv_select on public.product_stage_vendors for select to authenticated using (public.app_member_of_any(array['purchases','budgeting']));
    create policy psv_write on public.product_stage_vendors for all to authenticated
      using (public.app_admin_of_any(array['purchases'])) with check (public.app_admin_of_any(array['purchases']));
  end if;
  if to_regclass('public.product_workflows') is not null then
    create policy pw_select on public.product_workflows for select to authenticated using (public.app_member_of_any(array['purchases','inventory','troops','budgeting']));
    create policy pw_write on public.product_workflows for all to authenticated
      using (public.app_admin_of_any(array['purchases'])) with check (public.app_admin_of_any(array['purchases']));
  end if;
  if to_regclass('public.production_batches') is not null then
    create policy pb_select on public.production_batches for select to authenticated using (public.app_member_of_any(array['purchases','inventory','troops','budgeting']));
    create policy pb_write on public.production_batches for all to authenticated
      using (public.app_admin_of_any(array['purchases'])) with check (public.app_admin_of_any(array['purchases']));
  end if;

  ------------------------------------------------------------------------------
  -- Budgeting (money): budgeting team and full_admin only
  ------------------------------------------------------------------------------
  if to_regclass('public.budget_expenses') is not null then
    create policy be_select on public.budget_expenses for select to authenticated using (public.app_member_of_any(array['budgeting']));
    create policy be_write on public.budget_expenses for all to authenticated
      using (public.app_admin_of_any(array['budgeting'])) with check (public.app_admin_of_any(array['budgeting']));
  end if;
  if to_regclass('public.budget_settings') is not null then
    create policy bs_select on public.budget_settings for select to authenticated using (public.app_member_of_any(array['budgeting']));
    create policy bs_write on public.budget_settings for all to authenticated
      using (public.app_admin_of_any(array['budgeting'])) with check (public.app_admin_of_any(array['budgeting']));
  end if;
  if to_regclass('public.product_budget_profiles') is not null then
    create policy pbp_select on public.product_budget_profiles for select to authenticated using (public.app_member_of_any(array['budgeting','purchases']));
    create policy pbp_write on public.product_budget_profiles for all to authenticated
      using (public.app_admin_of_any(array['budgeting'])) with check (public.app_admin_of_any(array['budgeting']));
  end if;

  -- push_subscriptions: RLS on, no policy = nobody but the service role.

  ------------------------------------------------------------------------------
  -- Storage (product photos). Anyone can still LOOK (public bucket). Uploads now
  -- need a signed-in active non-leader.
  ------------------------------------------------------------------------------
  drop policy if exists "sps product images upload" on storage.objects;
  drop policy if exists "sps product images replace" on storage.objects;
  drop policy if exists "sps product images read" on storage.objects;
  create policy "sps product images read" on storage.objects
    for select to anon, authenticated using (bucket_id = 'product-images');
  create policy "sps product images upload" on storage.objects
    for insert to authenticated with check (bucket_id = 'product-images' and public.app_is_staff_or_above());
  create policy "sps product images replace" on storage.objects
    for update to authenticated using (bucket_id = 'product-images' and public.app_is_staff_or_above())
    with check (bucket_id = 'product-images' and public.app_is_staff_or_above());
end
$policies$;

-- ------------------------------------------------------------------------------
-- Leader-safe view: products' sizes and colors but NO quantity / threshold columns.
-- It runs with the owner's rights, so leaders need no access to product_variants.
-- ------------------------------------------------------------------------------
create or replace view public.leader_product_variants as
  select v.id, v.product_id, v.size, v.color_name, v.color_hex, v.sku
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where public.app_is_active()
    and coalesce(to_jsonb(p)->>'status', 'active') = 'active';
revoke all on public.leader_product_variants from public, anon;
grant select on public.leader_product_variants to authenticated;

-- ------------------------------------------------------------------------------
-- Guard triggers (they only act for signed-in API users; the SQL editor is exempt)
-- ------------------------------------------------------------------------------

-- Profiles: nobody changes their OWN role / status / teams (not even a full_admin).
-- A normal user can only change their own name, phone, username, avatar.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_self_ok text[] := array['full_name','phone','username','avatar_color','email'];
  v_protected text[] := array['role','status','requested_role','assigned_teams','assigned_fare2','approved_at','approved_by','approved_by_name'];
begin
  if v_uid is null then return new; end if;          -- SQL editor / service role
  if new.id <> old.id then raise exception 'Cannot change the account id'; end if;

  -- RULE: nobody (not even a full_admin) changes their OWN role, status or teams.
  if old.id = v_uid then
    if (select jsonb_object_agg(k, to_jsonb(new)->k) from unnest(v_protected) k)
       is distinct from (select jsonb_object_agg(k, to_jsonb(old)->k) from unnest(v_protected) k) then
      raise exception 'You cannot change your own role, status or teams. Only another full_admin can.' using errcode = '42501';
    end if;
  end if;

  -- Only a full_admin may change anything other than the harmless personal fields.
  if not public.app_is_full_admin() then
    if (to_jsonb(new) - v_self_ok - array['updated_at']) is distinct from (to_jsonb(old) - v_self_ok - array['updated_at']) then
      raise exception 'Only a full_admin can change roles, status or teams.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

-- user_teams change => keep the legacy profiles.assigned_teams list in sync.
create or replace function public.sync_assigned_teams() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user uuid := coalesce(new.user_id, old.user_id);
begin
  update public.profiles p
     set assigned_teams = coalesce((select jsonb_agg(ut.team_id order by ut.team_id) from public.user_teams ut where ut.user_id = v_user), '[]'::jsonb)
   where p.id = v_user;
  return null;
end $$;
drop trigger if exists sync_assigned_teams on public.user_teams;
create trigger sync_assigned_teams after insert or update or delete on public.user_teams
  for each row execute function public.sync_assigned_teams();

-- Who may DECIDE a request, and stamp who/when. Rule: full_admin or team_admin of
-- THAT team (app_is_team_admin). A requester may decide their own request if they hold that role.
create or replace function public.guard_request_decision() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_team text;
begin
  if v_uid is null then return new; end if;
  v_team := case when tg_table_name = 'team_change_requests' then to_jsonb(old)->>'team_scope' else 'inventory' end;
  if new.status::text is distinct from old.status::text then
    if old.status::text <> 'pending' then
      raise exception 'This request was already decided.' using errcode = '42501';
    end if;
    if not public.app_is_team_admin(v_team) then
      raise exception 'Only a full_admin or the team_admin of this team can decide requests.' using errcode = '42501';
    end if;
    if tg_table_name = 'team_change_requests' then
      new.reviewed_by_id := v_uid::text; new.reviewed_at := now();
    else
      new.admin_id := v_uid::text; new.reviewed_at := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_request_decision on public.team_change_requests;
create trigger guard_request_decision before update on public.team_change_requests
  for each row execute function public.guard_request_decision();
drop trigger if exists guard_request_decision on public.adjustment_requests;
create trigger guard_request_decision before update on public.adjustment_requests
  for each row execute function public.guard_request_decision();

-- Staff may not change protected product fields or any quantity.
create or replace function public.guard_product_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_keys text[] := array['name','sku','price','category','category_id','status','target_audience','quantity','min_threshold','product_id'];
begin
  if auth.uid() is null then return new; end if;
  -- apply_stock_change() (below) sets this flag for its own checked stock writes only.
  if coalesce(current_setting('app.stock_fn', true), '') = 'on' then return new; end if;
  if public.app_admin_of_any(array['inventory']) then return new; end if;
  if (select jsonb_object_agg(k, to_jsonb(new)->k) from unnest(v_keys) k)
     is distinct from (select jsonb_object_agg(k, to_jsonb(old)->k) from unnest(v_keys) k) then
    raise exception 'Only inventory admins can change names, prices, status or quantities.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_product_update on public.products;
create trigger guard_product_update before update on public.products
  for each row execute function public.guard_product_update();
drop trigger if exists guard_product_update on public.product_variants;
create trigger guard_product_update before update on public.product_variants
  for each row execute function public.guard_product_update();

-- Staff bookings: only the "request deposit change / payment check" fields may change.
create or replace function public.guard_booking_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_request text[] := array['pending_deposit_percentage','pending_deposit_percentage_by','pending_deposit_percentage_at',
    'payment_verification_requested','payment_verification_requested_by','payment_verification_requested_at',
    'payment_verification_note','updated_at'];
  v_payment text[];
  v_content text[] := array['booking_number','client_name','client_phone','notes','subtotal','discount','total',
    'deposit_rate','deposit_percentage','deposit_required','created_by_id','created_by_name','created_by_role','created_at'];
  v_diff text[];
  v_allowed text[];
begin
  if auth.uid() is null then return new; end if;
  v_payment := v_request || array['status','deposit_paid','deposit_paid_amount','deposit_paid_at',
    'final_paid_amount','final_paid_at','inventory_deducted'];
  select coalesce(array_agg(n.key), '{}') into v_diff
    from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o on o.key = n.key
   where n.value is distinct from o.value;
  -- Once a deposit or payment is confirmed, the order's details are frozen for everybody.
  if (old.deposit_paid or old.status <> 'pending') and v_diff && v_content then
    raise exception 'This order is locked: payment was already confirmed. Its details cannot be changed.' using errcode = '42501';
  end if;
  if public.app_admin_of_any(array['troops']) then return new; end if;            -- full_admin / Scout Fera2 team_admin
  if public.app_admin_of_any(array['budgeting']) then v_allowed := v_payment;      -- payment confirmation only
  elsif public.app_admin_of_any(array['inventory']) then v_allowed := array['stock_check_status','updated_at'];
  elsif public.app_member_of_any(array['troops','budgeting']) then v_allowed := v_request;  -- Fera2 + budgeting staff: may only ASK for a deposit/payment check
  else v_allowed := array['updated_at'];
  end if;
  if not (v_diff <@ v_allowed) then
    raise exception 'You are not allowed to change this on an order.' using errcode = '42501';
  end if;
  return new;
end $$;

-- Locked orders cannot be deleted, and their items cannot be changed (a brand-new order gets 2
-- minutes so its items can be saved right after the order row).
create or replace function public.guard_booking_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return old; end if;
  if old.deposit_paid or old.status <> 'pending' then
    raise exception 'This order is locked: payment was already confirmed. It cannot be deleted.' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists guard_booking_delete on public.bookings;
create trigger guard_booking_delete before delete on public.bookings
  for each row execute function public.guard_booking_delete();

create or replace function public.guard_booking_items() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_b record; v_id text := coalesce(to_jsonb(new)->>'booking_id', to_jsonb(old)->>'booking_id');
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select deposit_paid, status, created_at into v_b from public.bookings where id = v_id;
  if found and (v_b.deposit_paid or v_b.status <> 'pending')
     and not (tg_op = 'INSERT' and v_b.created_at > now() - interval '2 minutes') then
    raise exception 'This order is locked: payment was already confirmed. Its items cannot be changed.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists guard_booking_items on public.booking_items;
create trigger guard_booking_items before insert or update or delete on public.booking_items
  for each row execute function public.guard_booking_items();

-- Purchases/inventory admins mark an order "ready for handover" when its goods arrive, without
-- needing to read orders.
create or replace function public.mark_booking_ready(p_booking_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.app_admin_of_any(array['purchases','inventory']) then
    raise exception 'Only an admin of purchases or inventory can do this.' using errcode = '42501';
  end if;
  update public.bookings set stock_check_status = 'ready_for_handover', updated_at = now() where id = p_booking_id;
end $$;
revoke all on function public.mark_booking_ready(text) from public, anon;
grant execute on function public.mark_booking_ready(text) to authenticated;

-- Shortfall tracking: when a deposit is confirmed but stock is short (order 50, stock 30), the
-- app takes the 30 and records the 20 still owed. When the purchase batch linked to that order is
-- received, the owed units are taken from the received goods (100 received -> 80 left) and the
-- app shows a notice BEFORE saving (batch_receive_preview).
create table if not exists public.order_stock_owed (
  booking_id text not null,
  variant_id text not null,
  owed       integer not null check (owed > 0),
  primary key (booking_id, variant_id)
);
alter table public.order_stock_owed enable row level security;
revoke all on public.order_stock_owed from public, anon, authenticated;

create or replace function public.record_order_shortfall(p_booking_id text, p_variant_id text, p_owed integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.app_admin_of_any(array['budgeting','troops','inventory']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if p_owed is null or p_owed <= 0 then return; end if;
  if not exists (select 1 from public.bookings where id = p_booking_id and (deposit_paid or status <> 'pending')) then
    raise exception 'Order not found or deposit not confirmed.' using errcode = '42501';
  end if;
  insert into public.order_stock_owed(booking_id, variant_id, owed) values (p_booking_id, p_variant_id, p_owed)
  on conflict (booking_id, variant_id) do update set owed = excluded.owed;
end $$;
revoke all on function public.record_order_shortfall(text, text, integer) from public, anon;
grant execute on function public.record_order_shortfall(text, text, integer) to authenticated;

-- One purchase batch can cover several orders (same item): the first order is linked_booking_id,
-- the others are listed in extra_booking_ids. Receiving covers every linked order.
alter table public.production_batches add column if not exists extra_booking_ids text[] not null default '{}';
-- One batch may cover several sizes/colours of the same item: {variant_id: pieces}. Empty = just variant_id.
alter table public.production_batches add column if not exists variant_qty jsonb not null default '{}'::jsonb;

-- What would be reserved for the waiting order if p_qty of this variant arrive in this batch?
drop function if exists public.batch_receive_preview(text, text, integer);
create or replace function public.batch_receive_preview(p_batch_id text, p_variant_id text, p_qty integer)
returns table (reserved integer, booking_number text, client_name text, owed integer)
language plpgsql security definer set search_path = public as $$
begin
  if not public.app_admin_of_any(array['purchases','inventory']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return query
    select least(sum(o.owed), greatest(p_qty, 0))::integer,
           string_agg(b.booking_number::text, ', ' order by b.booking_number)::text,
           string_agg(b.client_name::text, ', ' order by b.booking_number)::text,
           sum(o.owed)::integer
      from public.production_batches pb
      join public.order_stock_owed o on o.variant_id = p_variant_id
           and (o.booking_id = pb.linked_booking_id or o.booking_id = any(pb.extra_booking_ids))
      join public.bookings b on b.id = o.booking_id
     where pb.id = p_batch_id
    having count(*) > 0;
end $$;
revoke all on function public.batch_receive_preview(text, text, integer) from public, anon;
grant execute on function public.batch_receive_preview(text, text, integer) to authenticated;

-- Receive goods: add p_qty, then take what the linked waiting order is still owed.
create or replace function public.receive_batch_stock(p_batch_id text, p_variant_id text, p_qty integer)
returns table (new_quantity integer, reserved integer)
language plpgsql security definer set search_path = public as $$
declare v_primary text; v_extra text[]; v_total integer := 0; v_take integer := 0; v_new integer;
begin
  if not public.app_is_staff_or_above() or not public.app_admin_of_any(array['purchases','inventory']) then
    raise exception 'Only an admin of the purchases team can add received stock.' using errcode = '42501';
  end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Nothing to receive.'; end if;
  select linked_booking_id, extra_booking_ids into v_primary, v_extra from public.production_batches where id = p_batch_id;
  if not found then raise exception 'Unknown purchase/production batch.' using errcode = '42501'; end if;
  perform 1 from public.order_stock_owed
   where variant_id = p_variant_id
     and (booking_id = v_primary or booking_id = any(coalesce(v_extra, '{}')))
   for update;
  select coalesce(sum(owed), 0) into v_total from public.order_stock_owed
   where variant_id = p_variant_id
     and (booking_id = v_primary or booking_id = any(coalesce(v_extra, '{}')));
  if v_total > 0 then
    if p_qty < v_total then
      raise exception 'This purchase is for orders that still need % pcs in total: the quantity made must be at least that (you entered %).', v_total, p_qty
        using errcode = '42501';
    end if;
    v_take := v_total;
    delete from public.order_stock_owed
     where variant_id = p_variant_id
       and (booking_id = v_primary or booking_id = any(coalesce(v_extra, '{}')));
  end if;
  perform set_config('app.stock_fn', 'on', true);
  update public.product_variants set quantity = greatest(0, quantity + p_qty - v_take), updated_at = now()
   where id = p_variant_id returning quantity into v_new;
  perform set_config('app.stock_fn', 'off', true);
  if v_new is null then raise exception 'Unknown item.'; end if;
  return query select v_new, v_take;
end $$;
revoke all on function public.receive_batch_stock(text, text, integer) from public, anon;
grant execute on function public.receive_batch_stock(text, text, integer) to authenticated;

-- Staff can SEE what orders still wait for (read-only), so the app can show "small shirt: need 20".
drop policy if exists owed_select on public.order_stock_owed;
create policy owed_select on public.order_stock_owed for select to authenticated
  using (public.app_member_of_any(array['troops','budgeting','inventory','purchases']));
grant select on public.order_stock_owed to authenticated;

-- A purchase batch linked to an order may never order LESS than the order still needs.
create or replace function public.guard_batch_min_quantity() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owed integer; v_have integer; r record;
begin
  if auth.uid() is null or new.linked_booking_id is null then return new; end if;
  if new.status = 'completed' then return new; end if;
  if new.variant_qty is not null and new.variant_qty <> '{}'::jsonb then
    -- Several sizes in one batch: every size must cover what the linked orders still need of that size.
    for r in select o.variant_id, sum(o.owed)::integer as owed from public.order_stock_owed o
              where (o.booking_id = new.linked_booking_id or o.booking_id = any(coalesce(new.extra_booking_ids, '{}')))
              group by o.variant_id loop
      v_have := coalesce((new.variant_qty ->> r.variant_id)::integer, 0);
      if r.owed > 0 and v_have < r.owed then
        raise exception 'These orders still need % pcs of one of the sizes: the quantity for it must be at least that (you entered %).', r.owed, v_have
          using errcode = '42501';
      end if;
    end loop;
    return new;
  end if;
  if new.variant_id is null then return new; end if;
  select coalesce(sum(owed), 0) into v_owed from public.order_stock_owed
   where variant_id = new.variant_id
     and (booking_id = new.linked_booking_id or booking_id = any(coalesce(new.extra_booking_ids, '{}')));
  if v_owed > 0 and new.quantity < v_owed then
    raise exception 'These orders still need % pcs in total: the quantity must be at least that (you entered %).', v_owed, new.quantity
      using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_batch_min_quantity on public.production_batches;
create trigger guard_batch_min_quantity before insert or update of quantity, status, linked_booking_id, extra_booking_ids, variant_id, variant_qty on public.production_batches
  for each row execute function public.guard_batch_min_quantity();

-- "Needs action" list: every paid order still waiting for stock, with the item/size and whether a
-- purchase has been started. Readable by anyone who may see orders or purchases (the app decides
-- who gets the action button).
create or replace function public.list_order_shortages()
returns table (booking_id text, booking_number text, client_name text, product_id text, variant_id text,
               product_name text, size text, color_name text, owed integer, has_batch boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.app_member_of_any(array['troops','budgeting','inventory','purchases']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return query
    select o.booking_id::text, b.booking_number::text, b.client_name::text, bi.product_id::text, o.variant_id::text,
           bi.product_name::text, bi.size::text, bi.color_name::text, o.owed::integer,
           exists (select 1 from public.production_batches pb
                    where (pb.linked_booking_id = o.booking_id or o.booking_id = any(pb.extra_booking_ids)) and (pb.variant_id = o.variant_id or pb.variant_qty ? o.variant_id) and pb.status = 'in_progress')
      from public.order_stock_owed o
      join public.bookings b on b.id = o.booking_id
      join lateral (select * from public.booking_items i where i.booking_id = o.booking_id and i.variant_id = o.variant_id limit 1) bi on true
     order by b.created_at desc;
end $$;
revoke all on function public.list_order_shortages() from public, anon;
grant execute on function public.list_order_shortages() to authenticated;
drop trigger if exists guard_booking_update on public.bookings;
create trigger guard_booking_update before update on public.bookings
  for each row execute function public.guard_booking_update();

-- Per-account throttle: at most N new rows per minute per person (default 20).
create or replace function public.throttle_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner_col text := tg_argv[0];
  v_time_col  text := tg_argv[1];
  v_limit     integer := coalesce(tg_argv[2]::integer, 20);
  v_count     integer;
begin
  if v_uid is null then return new; end if;
  execute format('select count(*) from public.%I where %I::text = $1 and %I > now() - interval ''1 minute''',
                 tg_table_name, v_owner_col, v_time_col)
    into v_count using v_uid::text;
  if v_count >= v_limit then
    raise exception 'Too many requests in one minute. Please wait a minute and try again.' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists throttle_insert on public.adjustment_requests;
create trigger throttle_insert before insert on public.adjustment_requests
  for each row execute function public.throttle_insert('worker_id', 'created_at', '20');
drop trigger if exists throttle_insert on public.team_change_requests;
create trigger throttle_insert before insert on public.team_change_requests
  for each row execute function public.throttle_insert('requested_by_id', 'requested_at', '20');
drop trigger if exists throttle_insert on public.bookings;
create trigger throttle_insert before insert on public.bookings
  for each row execute function public.throttle_insert('created_by_id', 'created_at', '10');

-- Server-side switch back off, and a report of the current state.
do $done$
begin
  if (select value from private.app_settings where key = 'allow_lockdown') = 'yes' then
    update private.app_settings set value = 'no' where key = 'allow_lockdown';
    insert into private.app_settings (key, value) values ('lockdown_done', now()::text) on conflict (key) do nothing;
    raise notice 'PART 2 DONE. Database is locked down. Switch set back to no.';
  end if;
end
$done$;

-- Handy checks (run any time):
--   Who is blocked / suspicious (last 7 days):
--     select created_at, kind, identifier, ip, detail from public.security_events
--      where created_at > now() - interval '7 days' order by created_at desc;
--   Accounts that need a new password after the copy: see the result of Part 1 above.
