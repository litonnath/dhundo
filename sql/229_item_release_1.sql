-- 229_item_release_1.sql -- part 1 of 2: a second hand item is paid out when the seller has handed it over
-- (completed), not when it is paid. Same rule as rides, bookings and orders. Needs 228.
create or replace function public.services_apply_payment(p_purpose text, p_ref uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_acct uuid;
  v_amt bigint := 0;
  v_note text;
  v_hold boolean := false;
  v_rider uuid;
begin
  if p_purpose = 'order' then
    update public.services_orders set paid = true, paid_at = now(), pay_method = 'upi', pay_hold = false,
           fee_prepaid_paise = public.services_order_fee_due(p_ref), updated_at = updated_at where id = p_ref;
    perform public.services_order_fee_settle(p_ref);
    select w.user_id, o.total_paise, o.ledger into v_acct, v_amt, v_hold
      from public.services_orders o join public.services_workers w on w.id = o.worker_id where o.id = p_ref;
    v_note := 'Order payment';
    select rw.user_id into v_rider from public.services_orders o
      join public.services_jobs j on j.id = o.job_id join public.services_workers rw on rw.id = j.rider_work where o.id = p_ref;
    perform public.services_notify(v_rider, 'pay_received', (v_amt / 100)::text);
  elsif p_purpose = 'ride' then
    update public.services_rides set paid_online = true where id = p_ref;
    select w.user_id, r.fare_paise, r.status <> 'done' into v_acct, v_amt, v_hold
      from public.services_rides r join public.services_workers w on w.id = r.driver_work where r.id = p_ref;
    v_note := 'Ride fare';
  elsif p_purpose = 'item' then
    update public.services_item_orders set paid_online = true where id = p_ref;
    select i.seller_id, (i.offer_rupees * 100)::bigint, i.status <> 'completed' into v_acct, v_amt, v_hold from public.services_item_orders i where i.id = p_ref;
    v_note := 'Item sale';
  elsif p_purpose = 'booking' then
    update public.services_bookings set paid_online = true where id = p_ref;
    select w.user_id, b.price_paise, b.status <> 'completed' into v_acct, v_amt, v_hold
      from public.services_bookings b join public.services_workers w on w.id = b.worker_id where b.id = p_ref;
    v_note := 'Booking payment';
  end if;
  perform public.services_notify(v_acct, 'pay_received', (coalesce(v_amt, 0) / 100)::text);
  if v_acct is not null and not coalesce(v_hold, false) and coalesce(v_amt, 0) > 0 then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (v_acct, v_amt, 'earning', v_note, p_purpose || ':' || p_ref::text)
    on conflict do nothing;
  end if;
end;
$fn$;
revoke all on function public.services_apply_payment(text, uuid) from public, anon, authenticated;
notify pgrst, 'reload schema';
select '229 item release part 1 done' as "229_1";
