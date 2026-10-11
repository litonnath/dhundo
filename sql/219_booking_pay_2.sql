-- 219_booking_pay_2.sql -- part 2 of 3: what a booking costs, and settling a
-- booking payment (mark paid, credit the worker's wallet). Run after part 1.
create or replace function public.services_payment_amount(p_me uuid, p_purpose text, p_ref uuid)
returns table (ok boolean, reason text, amount_paise int)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  o record;
  r record;
  i record;
  b record;
begin
  if p_purpose = 'order' then
    select x.* into o from public.services_orders x where x.id = p_ref and x.customer_id = p_me;
    if not found or o.status in ('rejected', 'cancelled') or o.paid then
      return query select false, 'not_payable'::text, 0; return;
    end if;
    return query select true, 'ok'::text,
      (o.total_paise + o.gst_paise + o.delivery_gst_paise + o.misc_fee_paise + o.misc_gst_paise)::int;
  elsif p_purpose = 'ride' then
    select x.* into r from public.services_rides x where x.id = p_ref and x.passenger_id = p_me;
    if not found or r.status not in ('accepted', 'done') or coalesce(r.fare_paise, 0) < 100 or r.paid_online or r.paid_cash then
      return query select false, 'not_payable'::text, 0; return;
    end if;
    return query select true, 'ok'::text, r.fare_paise::int;
  elsif p_purpose = 'item' then
    select x.* into i from public.services_item_orders x where x.id = p_ref and x.buyer_id = p_me;
    if not found or i.status not in ('requested', 'accepted') or i.offer_rupees < 1 or i.paid_online or i.paid_cash then
      return query select false, 'not_payable'::text, 0; return;
    end if;
    return query select true, 'ok'::text, (i.offer_rupees * 100)::int;
  elsif p_purpose = 'booking' then
    select x.* into b from public.services_bookings x where x.id = p_ref and x.customer_id = p_me;
    if not found or b.status not in ('accepted', 'completed') or coalesce(b.price_paise, 0) < 100 or b.paid_online or b.paid_cash then
      return query select false, 'not_payable'::text, 0; return;
    end if;
    return query select true, 'ok'::text, b.price_paise;
  else
    return query select false, 'bad_purpose'::text, 0;
  end if;
end;
$fn$;
revoke all on function public.services_payment_amount(uuid, text, uuid) from public, anon, authenticated;

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
    update public.services_orders set paid = true, paid_at = now(), pay_method = 'upi', updated_at = updated_at where id = p_ref;
    select w.user_id, o.total_paise into v_acct, v_amt
      from public.services_orders o join public.services_workers w on w.id = o.worker_id where o.id = p_ref;
    v_note := 'Order payment';
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
select '219 booking pay part 2 done' as "219_2";
