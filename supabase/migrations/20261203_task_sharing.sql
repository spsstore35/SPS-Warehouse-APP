-- Share an order task with ONE more person. Only the assigned person or the troops team_admin / full_admin
-- may set it; only the team_admin / full_admin may clear it. Rollback: drop function + columns.
alter table public.bookings add column if not exists shared_with_id text;
alter table public.bookings add column if not exists shared_with_name text;

create or replace function public.booking_share_task(p_booking text, p_user text) returns void
language plpgsql security definer set search_path = public as $$
declare v_b record; v_name text; v_is_admin boolean;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  v_is_admin := public.app_admin_of_any(array['troops']);
  select id, assigned_to_id into v_b from public.bookings where id::text = p_booking;
  if not found then raise exception 'Order not found'; end if;
  if p_user is null or p_user = '' then
    if not v_is_admin then raise exception 'Only the team admin or full admin can remove the shared person.' using errcode = '42501'; end if;
    perform set_config('app.share_ok', '1', true);
    update public.bookings set shared_with_id = null, shared_with_name = null, updated_at = now() where id::text = p_booking;
    return;
  end if;
  if not v_is_admin and coalesce(v_b.assigned_to_id, '') <> auth.uid()::text then
    raise exception 'Only the assigned person or the team admin can share this task.' using errcode = '42501';
  end if;
  if p_user = coalesce(v_b.assigned_to_id, '') then raise exception 'That person already has the task.'; end if;
  select p.full_name into v_name from public.profiles p
   where p.id::text = p_user and p.status::text = 'active' and p.role::text <> 'leader'
     and (p.role::text = 'full_admin' or exists (select 1 from public.user_teams ut where ut.user_id = p.id and ut.team_id = 'troops'));
  if v_name is null then raise exception 'That person is not in the Scout Fera2 team.'; end if;
  perform set_config('app.share_ok', '1', true);
  update public.bookings set shared_with_id = p_user, shared_with_name = v_name, updated_at = now() where id::text = p_booking;
end $$;
revoke all on function public.booking_share_task(text, text) from public, anon;
grant execute on function public.booking_share_task(text, text) to authenticated;

-- guard_booking_update: same as before + the share RPC may change only the two share columns.
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
  if (old.deposit_paid or old.status <> 'pending') and v_diff && v_content then
    raise exception 'This order is locked: payment was already confirmed. Its details cannot be changed.' using errcode = '42501';
  end if;
  if coalesce(current_setting('app.share_ok', true), '') = '1' and v_diff <@ array['shared_with_id','shared_with_name','updated_at'] then
    return new;
  end if;
  if public.app_admin_of_any(array['troops']) then return new; end if;
  if public.app_admin_of_any(array['budgeting']) then v_allowed := v_payment;
  elsif public.app_admin_of_any(array['inventory']) then v_allowed := array['stock_check_status','updated_at'];
  elsif public.app_member_of_any(array['troops','budgeting']) then v_allowed := v_request;
  else v_allowed := array['updated_at'];
  end if;
  if not (v_diff <@ v_allowed) then
    raise exception 'You are not allowed to change this on an order.' using errcode = '42501';
  end if;
  return new;
end $$;
