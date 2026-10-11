-- ===========================================================================
-- 220_payments_received.sql -- "Payments received" on the wallet screen: what
-- a partner has been paid, either into the wallet (online) or directly to them
-- (cash or a UPI QR they confirmed). Only the wallet ones change the balance.
-- Run after 214, 218 and 219.
-- ===========================================================================
create or replace function public.services_my_payments_received()
returns table (at timestamptz, what text, amount_paise bigint, via text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  with me as (select public.services_account_id() as id)
  select * from (
    select e.created_at as at, coalesce(e.note, 'Payment')::text as what, e.amount_paise, 'wallet'::text as via
      from public.services_wallet_entries e, me where e.account_id = me.id and e.kind = 'earning'
    union all
    select coalesce(r.done_at, r.accepted_at, r.created_at), 'Ride fare', r.fare_paise::bigint, 'direct'
      from public.services_rides r join public.services_workers w on w.id = r.driver_work, me
     where w.user_id = me.id and r.paid_cash
    union all
    select o.updated_at, 'Delivery partner fee', o.delivery_fee_paise::bigint, 'direct'
      from public.services_orders o join public.services_jobs j on j.id = o.job_id
      join public.services_workers rw on rw.id = j.rider_work, me
     where rw.user_id = me.id and o.rider_fee_paid
    union all
    select b.created_at, 'Booking payment', b.price_paise::bigint, 'direct'
      from public.services_bookings b join public.services_workers w on w.id = b.worker_id, me
     where w.user_id = me.id and b.paid_cash and b.price_paise is not null
    union all
    select coalesce(i.completed_at, i.updated_at), 'Item sale', (i.offer_rupees * 100)::bigint, 'direct'
      from public.services_item_orders i, me where i.seller_id = me.id and i.paid_cash
  ) x order by at desc limit 60;
$fn$;
revoke all on function public.services_my_payments_received() from public, anon;
grant execute on function public.services_my_payments_received() to authenticated;
notify pgrst, 'reload schema';
select '220 payments received done' as "220";
