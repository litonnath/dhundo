-- ===========================================================================
-- 218_pay_flags.sql -- who has been paid, for rides and for the delivery
-- partner fee. A ride is paid online (confirmed by PayU or the wallet) or the
-- driver confirms the cash/UPI was received. The same for the delivery
-- partner fee, confirmed by the rider. Either side can see the state, and the
-- other side's UPI id so the customer can pay by QR. Run after 213 and 215.
-- ===========================================================================
alter table public.services_rides add column if not exists paid_cash boolean not null default false;
alter table public.services_orders add column if not exists rider_fee_paid boolean not null default false;

create or replace function public.services_ride_pay_flags(p_ids uuid[])
returns table (id uuid, paid boolean, via text, fare_paise int, upi_id text, driver_name text, is_driver boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.id, (r.paid_online or r.paid_cash),
         case when r.paid_online then 'online' when r.paid_cash then 'cash' end,
         r.fare_paise,
         (select case when p.accepts_upi then p.upi_id end from public.services_biz_payment p where p.account_id = w.user_id),
         coalesce(nullif(btrim(w.business_name), ''), w.full_name)::text,
         (w.user_id = public.services_account_id())
    from public.services_rides r
    left join public.services_workers w on w.id = r.driver_work
   where r.id = any (p_ids)
     and (r.passenger_id = public.services_account_id() or w.user_id = public.services_account_id());
$fn$;
revoke all on function public.services_ride_pay_flags(uuid[]) from public, anon;
grant execute on function public.services_ride_pay_flags(uuid[]) to authenticated;

create or replace function public.services_ride_mark_paid(p_ride uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text; return;
  end if;
  update public.services_rides r set paid_cash = true
    from public.services_workers w
   where r.id = p_ride and w.id = r.driver_work and w.user_id = v_me and r.status in ('accepted', 'done');
  if not found then
    return query select false, 'not_allowed'::text; return;
  end if;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_ride_mark_paid(uuid) from public, anon;
grant execute on function public.services_ride_mark_paid(uuid) to authenticated;

-- The delivery partner fee of an order: what it is, whether the rider has
-- confirmed it was paid, and the rider's UPI id for a QR.
create or replace function public.services_order_fee_flags(p_ids uuid[])
returns table (order_id uuid, fee_paise int, paid boolean, upi_id text, rider_name text, is_rider boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select o.id, o.delivery_fee_paise, o.rider_fee_paid,
         (select case when p.accepts_upi then p.upi_id end from public.services_biz_payment p where p.account_id = rw.user_id),
         coalesce(nullif(btrim(rw.business_name), ''), rw.full_name)::text,
         (rw.user_id = public.services_account_id())
    from public.services_orders o
    join public.services_jobs j on j.id = o.job_id
    join public.services_workers rw on rw.id = j.rider_work
   where o.id = any (p_ids) and o.delivery_fee_paise > 0
     and (o.customer_id = public.services_account_id() or rw.user_id = public.services_account_id());
$fn$;
revoke all on function public.services_order_fee_flags(uuid[]) from public, anon;
grant execute on function public.services_order_fee_flags(uuid[]) to authenticated;

create or replace function public.services_order_fee_mark_paid(p_order uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text; return;
  end if;
  update public.services_orders o set rider_fee_paid = true, updated_at = o.updated_at
    from public.services_jobs j, public.services_workers rw
   where o.id = p_order and j.id = o.job_id and rw.id = j.rider_work and rw.user_id = v_me;
  if not found then
    return query select false, 'not_allowed'::text; return;
  end if;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_order_fee_mark_paid(uuid) from public, anon;
grant execute on function public.services_order_fee_mark_paid(uuid) to authenticated;
notify pgrst, 'reload schema';
select '218 pay flags done' as "218";
