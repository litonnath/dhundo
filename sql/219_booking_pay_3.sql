-- 219_booking_pay_3.sql -- part 3 of 3: pay a booking from the wallet, and
-- refund a paid booking that is cancelled or deleted. Run after part 2.
create or replace function public.services_wallet_pay(p_purpose text, p_ref uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  a record;
  v_bal bigint;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text; return;
  end if;
  if p_purpose not in ('order', 'ride', 'item', 'booking') then
    return query select false, 'bad_purpose'::text; return;
  end if;
  perform public.services_rate_guard('wallet_pay', v_me::text, 60, 3600);
  perform pg_advisory_xact_lock(hashtextextended(v_me::text, 1));
  select * into a from public.services_payment_amount(v_me, p_purpose, p_ref);
  if not a.ok then
    return query select false, a.reason; return;
  end if;
  select coalesce(sum(e.amount_paise), 0)::bigint into v_bal from public.services_wallet_entries e where e.account_id = v_me;
  if v_bal < a.amount_paise then
    return query select false, 'insufficient'::text; return;
  end if;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
  values (v_me, -a.amount_paise, 'spend', 'Paid for ' || p_purpose, 'spend:' || p_purpose || ':' || p_ref::text);
  insert into public.services_payments (account_id, purpose, ref_id, amount_paise, rp_order_id, status, paid_at)
  values (v_me, p_purpose, p_ref, a.amount_paise, 'wallet:' || gen_random_uuid()::text, 'paid', now());
  perform public.services_apply_payment(p_purpose, p_ref);
  return query select true, 'paid'::text;
end;
$fn$;
revoke all on function public.services_wallet_pay(text, uuid) from public, anon;
grant execute on function public.services_wallet_pay(text, uuid) to authenticated;

create or replace function public.services_refund_booking()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  p record;
  v_acct uuid;
begin
  select * into p from public.services_payments
   where purpose = 'booking' and ref_id = old.id and status = 'paid' and refunded_at is null limit 1 for update;
  if not found then return coalesce(new, old); end if;
  update public.services_payments set refunded_at = now() where id = p.id;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
  values (p.account_id, p.amount_paise, 'refund', 'Refund for a cancelled booking', 'refund:' || p.id::text) on conflict do nothing;
  select w.user_id into v_acct from public.services_workers w where w.id = old.worker_id;
  if v_acct is not null then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (v_acct, -p.amount_paise, 'adjustment', 'Booking cancelled: earning taken back', 'reverse:' || p.id::text) on conflict do nothing;
  end if;
  return coalesce(new, old);
end;
$fn$;
drop trigger if exists services_refund_booking_cancel on public.services_bookings;
create trigger services_refund_booking_cancel after update of status on public.services_bookings
  for each row when (new.status in ('cancelled', 'declined') and old.status is distinct from new.status)
  execute function public.services_refund_booking();
drop trigger if exists services_refund_booking_delete on public.services_bookings;
create trigger services_refund_booking_delete before delete on public.services_bookings
  for each row execute function public.services_refund_booking();
notify pgrst, 'reload schema';
select '219 booking pay part 3 done' as "219_3";
