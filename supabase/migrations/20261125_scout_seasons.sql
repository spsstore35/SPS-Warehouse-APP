-- Migration: Calendar-Connected Scout Seasons & Profile Team Assignments
-- Idempotent SQL safe to execute in Supabase SQL Editor.

alter table if exists public.profiles
  add column if not exists assigned_teams jsonb not null default '[]'::jsonb;

alter table if exists public.profiles
  add column if not exists assigned_fare2 jsonb not null default '[]'::jsonb;

create table if not exists public.scout_seasons (
  id text primary key,
  name text not null,
  start_date text not null,
  end_date text not null,
  color_hex text,
  notes text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scout_seasons enable row level security;

drop policy if exists "Allow anon and auth full access on scout_seasons" on public.scout_seasons;
create policy "Allow anon and auth full access on scout_seasons"
  on public.scout_seasons
  for all
  to anon, authenticated
  using (true)
  with check (true);
