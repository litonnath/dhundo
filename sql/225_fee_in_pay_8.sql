-- 225_fee_in_pay_8.sql -- part 8 of 8: orders whose fee is inside the payment no longer show the old
-- "pay the rider directly" flags (the rider's fee comes through the order payment instead).
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
   where o.id = any (p_ids) and o.delivery_fee_paise > 0 and not o.ledger
     and (o.customer_id = public.services_account_id() or rw.user_id = public.services_account_id());
$fn$;
revoke all on function public.services_order_fee_flags(uuid[]) from public, anon;
grant execute on function public.services_order_fee_flags(uuid[]) to authenticated;
select '225 fee in pay part 8 done' as "225_8";
