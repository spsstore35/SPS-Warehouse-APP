-- Public no-login order link: tables, columns, atomic order-creation function.
alter table public.bookings add column if not exists source text not null default 'app';
alter table public.bookings add column if not exists team_name text;
alter table public.booking_items add column if not exists required_pct integer;

create table if not exists public.public_sale_items (
  product_id text primary key references public.products(id) on delete cascade,
  is_open boolean not null default false,
  required_pct integer not null default 100 check (required_pct in (50,70,100)),
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.sale_settings (
  id integer primary key check (id = 1),
  orders_open boolean not null default true,
  max_per_ip_hour integer not null default 6,
  max_per_phone_hour integer not null default 3,
  max_per_day integer not null default 150
);
insert into public.sale_settings (id) values (1) on conflict do nothing;
create table if not exists public.public_order_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ip text, phone text, ok boolean not null default false
);
create index if not exists public_order_attempts_t on public.public_order_attempts (created_at);

alter table public.public_sale_items enable row level security;
alter table public.sale_settings enable row level security;
alter table public.public_order_attempts enable row level security;
drop policy if exists psi_select on public.public_sale_items;
drop policy if exists psi_write on public.public_sale_items;
drop policy if exists ss_select on public.sale_settings;
drop policy if exists ss_write on public.sale_settings;
create policy psi_select on public.public_sale_items for select to authenticated using (public.app_admin_of_any(array['troops','budgeting']));
create policy psi_write on public.public_sale_items for all to authenticated using (public.app_admin_of_any(array['troops'])) with check (public.app_admin_of_any(array['troops']));
create policy ss_select on public.sale_settings for select to authenticated using (public.app_admin_of_any(array['troops','budgeting']));
create policy ss_write on public.sale_settings for all to authenticated using (public.app_admin_of_any(array['troops'])) with check (public.app_admin_of_any(array['troops']));
revoke all on public.public_sale_items, public.sale_settings, public.public_order_attempts from anon;

create or replace function public.public_order_create(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p->>'name',''));
  v_phone text := btrim(coalesce(p->>'phone',''));
  v_ash text := btrim(coalesce(p->>'ashira',''));
  v_team text := btrim(coalesce(p->>'team',''));
  v_open boolean;
  v_it jsonb; v_var record; v_pct int; v_qty int; v_n int := 0;
  v_id text; v_num text; v_prefix text; v_seq int;
  v_sub numeric := 0; v_req numeric := 0; v_line numeric; v_rows jsonb := '[]'::jsonb; r jsonb;
begin
  select orders_open into v_open from sale_settings where id = 1;
  if not coalesce(v_open,false) then raise exception 'closed' using errcode='P0001'; end if;
  if length(v_name) < 2 or length(v_name) > 80 then raise exception 'bad_name' using errcode='P0001'; end if;
  v_phone := public.normalize_egypt_phone(v_phone);
  if v_phone is null or v_phone !~ '^[0-9+]{8,16}$' then raise exception 'bad_phone' using errcode='P0001'; end if;
  if v_ash not in ('3ashera 1','3ashera 2') then raise exception 'bad_ashira' using errcode='P0001'; end if;
  if length(v_team) < 2 or length(v_team) > 60 then raise exception 'bad_team' using errcode='P0001'; end if;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 or jsonb_array_length(p->'items') > 15 then
    raise exception 'bad_items' using errcode='P0001'; end if;
  for v_it in select * from jsonb_array_elements(p->'items') loop
    v_qty := (v_it->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 10 then raise exception 'bad_qty' using errcode='P0001'; end if;
    select v.*, pr.name pname, pr.sku psku, pr.price pprice, pr.image_url pimg, s.required_pct rp
      into v_var
      from product_variants v join products pr on pr.id = v.product_id
      join public_sale_items s on s.product_id = pr.id and s.is_open
     where v.id = (v_it->>'variant_id') and pr.status = 'active';
    if not found or v_var.pprice is null or v_var.pprice <= 0 then raise exception 'bad_item' using errcode='P0001'; end if;
    v_line := v_var.pprice * v_qty;
    v_sub := v_sub + v_line;
    v_req := v_req + round(v_line * v_var.rp / 100.0, 2);
    v_rows := v_rows || jsonb_build_object('var', to_jsonb(v_var), 'qty', v_qty, 'line', v_line);
  end loop;
  v_prefix := 'SPS-' || to_char(now() at time zone 'Africa/Cairo','DDMMYY');
  select coalesce(max(substring(booking_number from length(v_prefix)+1)::int),0)+1 into v_seq
    from bookings where booking_number like v_prefix || '%' and substring(booking_number from length(v_prefix)+1) ~ '^[0-9]+$';
  v_num := v_prefix || lpad(v_seq::text,2,'0');
  v_id := 'bk_' || (extract(epoch from clock_timestamp())*1000)::bigint::text || floor(random()*1000)::int::text;
  insert into bookings (id, booking_number, client_name, client_phone, notes, subtotal, discount, total,
    deposit_rate, deposit_percentage, deposit_required, deposit_paid, deposit_paid_amount, status, inventory_deducted,
    created_by_id, created_by_name, created_by_role, troop_group, assigned_fare2, source, team_name)
  values (v_id, v_num, v_name, v_phone, 'Public order link | ' || v_ash || ' | Team: ' || v_team,
    v_sub, 0, v_sub, round(v_req / v_sub, 4), round(v_req / v_sub * 100)::int, v_req, false, 0, 'pending', false,
    (select id from profiles where role='full_admin' order by created_at limit 1), 'Public order link', 'worker', v_ash, v_ash, 'public_link', v_team);
  for r in select * from jsonb_array_elements(v_rows) loop
    v_n := v_n + 1;
    insert into booking_items (id, booking_id, product_id, product_name, product_sku, product_image, variant_id, size,
      color_name, color_hex, quantity, unit_price, total_price, available_stock, deficit_quantity, min_threshold, required_pct)
    values (v_id || '_i' || v_n, v_id, r->'var'->>'product_id', r->'var'->>'pname', r->'var'->>'psku', null,
      r->'var'->>'id', r->'var'->>'size', r->'var'->>'color_name', r->'var'->>'color_hex', (r->>'qty')::int,
      (r->'var'->>'pprice')::numeric, (r->>'line')::numeric, (r->'var'->>'quantity')::bigint,
      greatest(0, (r->>'qty')::int - (r->'var'->>'quantity')::bigint), coalesce((r->'var'->>'min_threshold')::int,5),
      (r->'var'->>'rp')::int);
  end loop;
  return jsonb_build_object('order_number', v_num, 'total', v_sub, 'required', v_req);
end $$;
revoke all on function public.public_order_create(jsonb) from public, anon, authenticated;
grant execute on function public.public_order_create(jsonb) to service_role;
