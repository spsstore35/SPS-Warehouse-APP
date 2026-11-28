-- "Sent on WhatsApp" marker on an order. Anyone who can work orders (troops/budgeting members, admins) may set it,
-- through this function only. Rollback: drop function + columns + remove the wa_ok clause from guard_booking_update.
alter table public.bookings add column if not exists wa_sent_at timestamptz;
alter table public.bookings add column if not exists wa_sent_by_name text;

create or replace function public.booking_mark_wa_sent(p_booking text) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if not (public.app_is_full_admin() or public.app_member_of_any(array['troops','budgeting']) or public.app_admin_of_any(array['troops','budgeting'])) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  select p.full_name into v_name from public.profiles p where p.id = auth.uid();
  perform set_config('app.wa_ok', '1', true);
  update public.bookings set wa_sent_at = now(), wa_sent_by_name = v_name, updated_at = now() where id::text = p_booking;
end $$;
revoke all on function public.booking_mark_wa_sent(text) from public, anon;
grant execute on function public.booking_mark_wa_sent(text) to authenticated;

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
  if coalesce(current_setting('app.wa_ok', true), '') = '1' and v_diff <@ array['wa_sent_at','wa_sent_by_name','updated_at'] then
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
