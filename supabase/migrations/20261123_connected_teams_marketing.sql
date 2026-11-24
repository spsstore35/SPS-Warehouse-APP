-- SPS Warehouse: Connected 6-Team Workflow & Marketing Offers Migration
-- Safe and idempotent to run multiple times in Supabase SQL Editor.

-- 1. Marketing Offers Table (Product promos, discounts & campaign schedule)
create table if not exists public.marketing_offers (
  id text primary key,
  product_id text not null,
  title text not null,
  offer_type text not null check (offer_type in ('percentage', 'fixed_price', 'bundle_note')) default 'percentage',
  discount_percent numeric(5,2) not null default 0,
  offer_price numeric(12,2),
  badge_text text not null default 'Special Offer',
  start_date date not null default current_date,
  end_date date not null default (current_date + interval '14 days')::date,
  status text not null check (status in ('active', 'scheduled', 'paused', 'ended')) default 'active',
  notes text,
  created_by_id text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketing_offers_product on public.marketing_offers(product_id);
create index if not exists idx_marketing_offers_status on public.marketing_offers(status);

alter table public.marketing_offers enable row level security;

drop policy if exists "sps marketing_offers anon all" on public.marketing_offers;
create policy "sps marketing_offers anon all"
  on public.marketing_offers
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- 2. Calendar Events & Team Board Link Columns (Bookings, Batches, Marketing Offers)
alter table if exists public.calendar_events
  add column if not exists linked_booking_id text,
  add column if not exists linked_batch_id text,
  add column if not exists linked_offer_id text,
  add column if not exists workflow_stage text;

create index if not exists idx_calendar_events_booking on public.calendar_events(linked_booking_id);
create index if not exists idx_calendar_events_batch on public.calendar_events(linked_batch_id);
create index if not exists idx_calendar_events_offer on public.calendar_events(linked_offer_id);

-- 3. Bookings Stock-Check Pipeline Status Column
alter table if exists public.bookings
  add column if not exists stock_check_status text;

-- 4. Production Batches Order Link Columns
alter table if exists public.production_batches
  add column if not exists linked_booking_id text,
  add column if not exists linked_booking_number text,
  add column if not exists requested_by_team text;

create index if not exists idx_production_batches_booking on public.production_batches(linked_booking_id);

-- 5. Ensure Users table supports multi-team & Scout Fera2 arrays
alter table if exists public.users
  add column if not exists assigned_teams jsonb not null default '[]'::jsonb,
  add column if not exists assigned_fare2 jsonb not null default '[]'::jsonb;
