-- 227_hold_until_done_1.sql -- part 1 of 3: money for an order is held by Dhundo until the order is delivered.
-- Nobody is credited when the customer pays; a cancelled order simply refunds the customer.
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
begin
  if p_purpose = 'order' then
    update public.services_orders set paid = true, paid_at = now(), pay_method = 'upi', pay_hold = false,
           fee_prepaid_paise = public.services_order_fee_due(p_ref), updated_at = updated_at where id = p_ref;
    perform public.services_order_fee_settle(p_ref);
    select w.user_id, o.total_paise into v_acct, v_amt
      from public.services_orders o join public.services_workers w on w.id = o.worker_id where o.id = p_ref;
    v_note := 'Order payment';
    -- Orders made after 225 are paid out when delivered, not when paid.
    if exists (select 1 from public.services_orders where id = p_ref and ledger) then v_acct := null; end if;
  elsif p_purpose = 'ride' then
    update public.services_rides set paid_online = true where id = p_ref;
    select w.user_id, r.fare_paise into v_acct, v_amt
      from public.services_rides r join public.services_workers w on w.id = r.driver_work where r.id = p_ref;
    v_note := 'Ride fare';
  elsif p_purpose = 'item' then
    update public.services_item_orders set paid_online = true where id = p_ref;
    select i.seller_id, (i.offer_rupees * 100)::bigint into v_acct, v_amt from public.services_item_orders i where i.id = p_ref;
    v_note := 'Item sale';
  elsif p_purpose = 'booking' then
    update public.services_bookings set paid_online = true where id = p_ref;
    select w.user_id, b.price_paise into v_acct, v_amt
      from public.services_bookings b join public.services_workers w on w.id = b.worker_id where b.id = p_ref;
    v_note := 'Booking payment';
  end if;
  if v_acct is not null and coalesce(v_amt, 0) > 0 then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (v_acct, v_amt, 'earning', v_note, p_purpose || ':' || p_ref::text)
    on conflict do nothing;
  end if;
end;
$fn$;
revoke all on function public.services_apply_payment(text, uuid) from public, anon, authenticated;
notify pgrst, 'reload schema';
select '227 hold part 1 done' as "227_1";
