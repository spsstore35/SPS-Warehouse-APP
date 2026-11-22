-- SPS Warehouse: Sourcing & Production Operations Relational Schema
-- Tables: vendors, product_workflows, product_stage_vendors, vendor_price_history, production_batches
-- Safe to run more than once.

create table if not exists public.vendors (
  id text primary key,
  name text not null,
  location text not null default '',
  maps_url text,
  contact_person text,
  phone text,
  tags jsonb not null default '[]'::jsonb,
  general_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_workflows (
  id text primary key,
  product_id text not null unique,
  workflow_type text not null check (workflow_type in ('manufactured', 'ready_made')),
  active_stages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.product_stage_vendors (
  id text primary key,
  product_id text not null,
  stage_key text not null,
  vendor_id text not null references public.vendors(id) on delete cascade,
  is_primary boolean not null default false,
  approx_order_qty text default '',
  order_script_notes text default '',
  created_at timestamptz not null default now(),
  unique (product_id, stage_key, vendor_id)
);

create table if not exists public.vendor_price_history (
  id text primary key,
  product_stage_vendor_id text not null references public.product_stage_vendors(id) on delete cascade,
  purchase_date date not null default current_date,
  unit_price numeric(12,2) not null default 0,
  quantity text not null default '',
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.production_batches (
  id text primary key,
  batch_code text not null,
  product_id text not null,
  variant_id text,
  quantity integer not null default 0,
  target_date date,
  current_stage_key text not null,
  status text not null check (status in ('in_progress', 'completed')) default 'in_progress',
  stage_assignments jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_product_stage_vendors_product on public.product_stage_vendors(product_id);
create index if not exists idx_product_stage_vendors_vendor on public.product_stage_vendors(vendor_id);
create index if not exists idx_vendor_price_history_psv on public.vendor_price_history(product_stage_vendor_id);
create index if not exists idx_production_batches_product on public.production_batches(product_id);
create index if not exists idx_production_batches_status on public.production_batches(status);

alter table public.vendors enable row level security;
alter table public.product_workflows enable row level security;
alter table public.product_stage_vendors enable row level security;
alter table public.vendor_price_history enable row level security;
alter table public.production_batches enable row level security;

drop policy if exists "sps vendors anon all" on public.vendors;
create policy "sps vendors anon all" on public.vendors for all to anon, authenticated using (true) with check (true);

drop policy if exists "sps product_workflows anon all" on public.product_workflows;
create policy "sps product_workflows anon all" on public.product_workflows for all to anon, authenticated using (true) with check (true);

drop policy if exists "sps product_stage_vendors anon all" on public.product_stage_vendors;
create policy "sps product_stage_vendors anon all" on public.product_stage_vendors for all to anon, authenticated using (true) with check (true);

drop policy if exists "sps vendor_price_history anon all" on public.vendor_price_history;
create policy "sps vendor_price_history anon all" on public.vendor_price_history for all to anon, authenticated using (true) with check (true);

drop policy if exists "sps production_batches anon all" on public.production_batches;
create policy "sps production_batches anon all" on public.production_batches for all to anon, authenticated using (true) with check (true);
