-- 223_pay_guard_1.sql -- no double payment. Part 1 of 2; run 223_pay_guard_2.sql next.
-- If a PayU payment arrives for something already settled (paid in cash/QR, or
-- paid twice), or PayU reports a different amount, nobody is credited; the
-- payment is saved with an "issue" so the admin can refund it. Needs 215, 219.
alter table public.services_payments add column if not exists issue text;

create or replace function public.services_pay_target_open(p_purpose text, p_ref uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select case p_purpose
    when 'order' then coalesce((select not o.paid and o.status not in ('rejected', 'cancelled') from public.services_orders o where o.id = p_ref), false)
    when 'ride' then coalesce((select not (r.paid_online or r.paid_cash) from public.services_rides r where r.id = p_ref), false)
    when 'item' then coalesce((select not (i.paid_online or i.paid_cash) from public.services_item_orders i where i.id = p_ref), false)
    when 'booking' then coalesce((select not (b.paid_online or b.paid_cash) from public.services_bookings b where b.id = p_ref), false)
    else false end;
$fn$;
revoke all on function public.services_pay_target_open(text, uuid) from public, anon, authenticated;

create or replace function public.services_payment_mark_paid(p_rp_order text, p_rp_payment text, p_amount int)
returns text
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  p record;
begin
  select * into p from public.services_payments where rp_order_id = p_rp_order for update;
  if not found then return 'unknown_order'; end if;
  if p.status = 'paid' then return 'already'; end if;
  update public.services_payments set status = 'paid', rp_payment_id = p_rp_payment, paid_at = now() where id = p.id;
  if p_amount is not null and p_amount <> p.amount_paise then
    update public.services_payments set issue = 'amount_mismatch: PayU says ' || p_amount::text || ' paise' where id = p.id;
    return 'review';
  end if;
  if p.purpose = 'topup' then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (p.account_id, p.amount_paise, 'topup', 'Money added', 'topup:' || p.id::text) on conflict do nothing;
    return 'paid';
  end if;
  if not public.services_pay_target_open(p.purpose, p.ref_id) then
    update public.services_payments set issue = 'duplicate: already settled' where id = p.id;
    return 'review';
  end if;
  perform public.services_apply_payment(p.purpose, p.ref_id);
  return 'paid';
end;
$fn$;
revoke all on function public.services_payment_mark_paid(text, text, int) from public, anon, authenticated;
grant execute on function public.services_payment_mark_paid(text, text, int) to service_role;

-- A cash/QR confirmation is refused once the money came in online.
create or replace function public.services_ride_mark_paid(p_ride uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if public.services_account_id() is null then
    return query select false, 'sign_in_required'::text; return;
  end if;
  update public.services_rides r set paid_cash = true from public.services_workers w
   where r.id = p_ride and w.id = r.driver_work and w.user_id = public.services_account_id()
     and r.status in ('accepted', 'done') and not r.paid_online;
  if not found then
    return query select false, 'not_allowed'::text; return;
  end if;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_ride_mark_paid(uuid) from public, anon;
grant execute on function public.services_ride_mark_paid(uuid) to authenticated;
select '223 pay guard part 1 done' as "223_1";
