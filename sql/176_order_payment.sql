-- ===========================================================================
-- 176_order_payment.sql -- paid or unpaid, and how: cash on delivery or UPI.
-- The customer picks the way ('cod' or 'upi'); after paying a shop's UPI id
-- they can say 'upi_sent'; the shop, or the rider who holds the delivery (who
-- collected the cash), marks the order paid ('mark_paid'). Money itself still
-- goes straight to the shop or rider; this only records and shows it.
-- Run after 164_order_charges.sql.
-- ===========================================================================
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
           upi_claimed = (p_action = 'upi_sent'), updated_at = updated_at
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
notify pgrst, 'reload schema';
select '176 order payment done' as "176";
