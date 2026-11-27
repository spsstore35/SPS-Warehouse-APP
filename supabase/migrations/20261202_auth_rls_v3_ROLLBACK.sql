-- ==============================================================================
-- SPS WAREHOUSE - EMERGENCY ROLLBACK of 20261202_auth_rls_v3.sql (Part 2)
-- Use ONLY if the new site cannot be used and you must go back to the old site.
-- WARNING: this makes the database OPEN again (anyone with the public key can read
-- and write). Go back to the new setup as soon as you can.
-- After running it, redeploy the OLD version of the site (the "main" branch from
-- before the merge) in Vercel, then ALSO run 20261128_login_username_phone_rls.sql
-- to bring back the old login lookup function.
-- ==============================================================================
do $rb$
declare pol record; t record;
begin
  -- 1. put the old password hashes back (so the old login works with old passwords;
  --    passwords changed since the switch are NOT restored)
  if to_regclass('private.legacy_password_hashes') is not null then
    update public.profiles p set password_hash = l.password_hash
      from private.legacy_password_hashes l where l.profile_id = p.id and l.password_hash is not null;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='password_plain') then
      execute 'update public.profiles p set password_plain = l.password_plain from private.legacy_password_hashes l where l.profile_id = p.id and l.password_plain is not null';
    end if;
  end if;

  alter table public.profiles drop constraint if exists profiles_id_auth_fkey;

  -- 2. remove the new policies and open every table again, like before
  for pol in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t.tablename);
    if t.tablename not in ('push_subscriptions', 'security_events') then
      execute format('create policy "rollback open access" on public.%I for all to anon, authenticated using (true) with check (true)', t.tablename);
    end if;
  end loop;

  -- 3. storage uploads like before
  drop policy if exists "sps product images upload" on storage.objects;
  drop policy if exists "sps product images replace" on storage.objects;
  create policy "sps product images upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'product-images');
  create policy "sps product images replace" on storage.objects for update to anon, authenticated using (bucket_id = 'product-images') with check (bucket_id = 'product-images');

  -- 4. let the old push registration work again
  if to_regprocedure('public.register_push_subscription(text,jsonb,text)') is not null then
    grant execute on function public.register_push_subscription(text, jsonb, text) to anon, authenticated;
  end if;

  -- 5. let Part 2 be run again later
  delete from private.app_settings where key in ('lockdown_done', 'allow_lockdown');
end
$rb$;
