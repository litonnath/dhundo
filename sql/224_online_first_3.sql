-- 224_online_first_3.sql -- part 3 of 5: choosing cash on delivery releases a held order; the order price includes the cash fee.
create or replace function public.services_order_pay(p_order uuid, p_action text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  o record;
  v_shop boolean;
  v_rider boolean;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('order_pay', v_me::text, 60, 86400);
  select x.* into o from public.services_orders x where x.id = p_order for update;
  if not found or o.status in ('rejected', 'cancelled') then
    return query select false, 'no_change'::text;
    return;
  end if;
  v_shop := exists (select 1 from public.services_workers w where w.id = o.worker_id and w.user_id = v_me);
  v_rider := o.job_id is not null and exists (
    select 1 from public.services_jobs j join public.services_workers r on r.id = j.rider_work
     where j.id = o.job_id and r.user_id = v_me);
  if p_action in ('cod', 'upi', 'upi_sent') and o.customer_id = v_me and not o.paid and o.status <> 'delivered' then
    update public.services_orders
       set pay_method = case when p_action = 'cod' then 'cod' else 'upi' end,
           upi_claimed = (p_action = 'upi_sent'), pay_hold = case when p_action = 'cod' then false else pay_hold end, updated_at = updated_at
     where id = o.id;
  elsif p_action = 'mark_paid' and (v_shop or v_rider) and not o.paid then
    update public.services_orders set paid = true, paid_at = now(), updated_at = updated_at where id = o.id;
  else
    return query select false, 'not_allowed'::text;
    return;
  end if;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_order_pay(uuid, text) from public, anon;
grant execute on function public.services_order_pay(uuid, text) to authenticated;

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
      (o.total_paise + o.gst_paise + o.delivery_gst_paise + o.misc_fee_paise + o.misc_gst_paise + o.cod_fee_paise)::int;
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

