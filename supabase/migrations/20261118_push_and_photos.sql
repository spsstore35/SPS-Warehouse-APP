-- SPS Warehouse: product photo storage + background push notifications
-- Safe to run more than once.

------------------------------------------------------------------
-- 1. PRODUCT PHOTOS: public storage bucket
------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The app signs people in with its own profiles table (not Supabase Auth), so uploads
-- come from the public "anon" role, like every other write the app makes.
drop policy if exists "sps product images read" on storage.objects;
create policy "sps product images read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');

drop policy if exists "sps product images upload" on storage.objects;
create policy "sps product images upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'product-images');

drop policy if exists "sps product images replace" on storage.objects;
create policy "sps product images replace" on storage.objects
  for update to anon, authenticated using (bucket_id = 'product-images') with check (bucket_id = 'product-images');

------------------------------------------------------------------
-- 2. PUSH SUBSCRIPTIONS (one row per phone / computer)
------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint     text primary key,
  subscription jsonb not null,
  user_email   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- No public read/write: devices register only through the function below,
-- and only the notify-push function (service role) reads the list.
alter table public.push_subscriptions enable row level security;

create or replace function public.register_push_subscription(
  p_endpoint text, p_subscription jsonb, p_user_email text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'invalid push endpoint';
  end if;
  insert into public.push_subscriptions (endpoint, subscription, user_email)
  values (p_endpoint, p_subscription, lower(p_user_email))
  on conflict (endpoint) do update
    set subscription = excluded.subscription,
        user_email   = coalesce(excluded.user_email, public.push_subscriptions.user_email),
        updated_at   = now();
end $$;
revoke all on function public.register_push_subscription(text, jsonb, text) from public;
grant execute on function public.register_push_subscription(text, jsonb, text) to anon, authenticated;

------------------------------------------------------------------
-- 3. TRIGGERS -> notify-push Edge Function
------------------------------------------------------------------
create extension if not exists pg_net;

-- Private settings (not exposed through the API). The webhook secret is inserted
-- separately at setup time and is never stored in the repository.
create schema if not exists private;
create table if not exists private.app_settings (key text primary key, value text not null);
revoke all on schema private from anon, authenticated;

create or replace function public.sps_notify_push() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  v_secret text;
begin
  select value into v_secret from private.app_settings where key = 'push_webhook_secret';
  if v_secret is null then
    return new;
  end if;
  perform net.http_post(
    url     := 'https://tvlfxyfbyhotqgigurec.supabase.co/functions/v1/notify-push',
    body    := jsonb_build_object('table', tg_table_name, 'type', tg_op, 'record', to_jsonb(new) - 'password_hash'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Never block saving data because a notification could not be sent.
  return new;
end $$;

drop trigger if exists sps_push_on_activity on public.stock_audit_logs;
create trigger sps_push_on_activity after insert on public.stock_audit_logs
  for each row execute function public.sps_notify_push();

drop trigger if exists sps_push_on_request on public.adjustment_requests;
create trigger sps_push_on_request after insert on public.adjustment_requests
  for each row execute function public.sps_notify_push();

drop trigger if exists sps_push_on_registration on public.profiles;
create trigger sps_push_on_registration after insert on public.profiles
  for each row when (new.status = 'pending') execute function public.sps_notify_push();
