-- ===========================================================================
-- 190_delivery_rateable.sql -- which of these orders can I still rate: delivered,
-- taken by a rider, I am the customer or that rider, and I have not rated yet.
-- The app shows the rating box only for those. Run after 187.
-- ===========================================================================
create or replace function public.services_delivery_rateable(p_orders uuid[])
returns table (order_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select o.id
    from public.services_orders o
    join public.services_jobs j on j.id = o.job_id
    join public.services_workers w on w.id = j.rider_work
   where o.id = any (coalesce(p_orders, '{}'::uuid[]))
     and o.status = 'delivered'
     and (o.customer_id = public.services_account_id() or w.user_id = public.services_account_id())
     and not exists (select 1 from public.services_delivery_ratings r
                      where r.order_id = o.id and r.from_account = public.services_account_id());
$fn$;
revoke all on function public.services_delivery_rateable(uuid[]) from public, anon;
grant execute on function public.services_delivery_rateable(uuid[]) to authenticated;
notify pgrst, 'reload schema';
select '190 delivery rateable done' as "190";
