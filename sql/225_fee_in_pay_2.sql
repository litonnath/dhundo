-- 225_fee_in_pay_2.sql -- part 2 of 6: an order's online price includes the delivery partner fee.
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
      (o.total_paise + o.gst_paise + o.delivery_gst_paise + o.misc_fee_paise + o.misc_gst_paise + public.services_order_fee_due(o.id))::int;
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

notify pgrst, 'reload schema';
select '225 fee in pay part 2 done' as "225_2";
