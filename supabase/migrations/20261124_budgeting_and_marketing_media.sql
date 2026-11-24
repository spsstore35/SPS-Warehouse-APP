-- SPS Warehouse: Budgeting, Unit Economics, Liquidity & Expenses Migration
-- Safe and idempotent to run multiple times in Supabase SQL Editor.

-- 1. Product Unit Cost, Margin % & Hardship Discount Profiles
create table if not exists public.product_budget_profiles (
  product_id text primary key,
  manufacturing_cost numeric(12,2) not null default 0,
  extra_prep_cost numeric(12,2) not null default 0,
  target_margin_percent numeric(6,2),
  hardship_discount_type text check (hardship_discount_type in ('percentage', 'fixed_amount')),
  hardship_discount_value numeric(12,2),
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.product_budget_profiles enable row level security;

drop policy if exists "sps product_budget_profiles anon all" on public.product_budget_profiles;
create policy "sps product_budget_profiles anon all"
  on public.product_budget_profiles
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- 2. Store Operating & Ready-for-Sale Expenses Ledger
create table if not exists public.budget_expenses (
  id text primary key,
  title text not null,
  category text not null check (
    category in (
      'production_extras',
      'packaging',
      'transport',
      'rent_utilities',
      'marketing',
      'hardship_subsidy',
      'other'
    )
  ) default 'other',
  amount numeric(12,2) not null default 0,
  expense_date date not null default current_date,
  linked_product_id text,
  notes text,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_budget_expenses_date on public.budget_expenses(expense_date desc);

alter table public.budget_expenses enable row level security;

drop policy if exists "sps budget_expenses anon all" on public.budget_expenses;
create policy "sps budget_expenses anon all"
  on public.budget_expenses
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- 3. Store Liquidity (El Seyoola) & Reserve Buffer Settings
create table if not exists public.budget_settings (
  id text primary key default 'default',
  cash_on_hand numeric(14,2),
  reserve_buffer numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.budget_settings enable row level security;

drop policy if exists "sps budget_settings anon all" on public.budget_settings;
create policy "sps budget_settings anon all"
  on public.budget_settings
  for all
  to anon, authenticated
  using (true)
  with check (true);
