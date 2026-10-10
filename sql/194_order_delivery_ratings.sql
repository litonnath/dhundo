-- ===========================================================================
-- 194_order_delivery_ratings.sql -- both ratings on a delivery (the customer's
-- rating of the rider and the rider's rating of the customer), for the two
-- people on that delivery only, so each can see what was said both ways.
-- Run after 187.
-- ===========================================================================
create or replace function public.services_order_delivery_ratings(p_orders uuid[])
returns table (order_id uuid, by_role text, stars int, comment text, complaint boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.order_id, r.by_role::text, r.stars, r.comment::text, r.complaint
    from public.services_delivery_ratings r
    join public.services_orders o on o.id = r.order_id
    left join public.services_jobs j on j.id = o.job_id
    left join public.services_workers w on w.id = j.rider_work
   where r.order_id = any (coalesce(p_orders, '{}'::uuid[]))
     and (o.customer_id = public.services_account_id() or w.user_id = public.services_account_id());
$fn$;
revoke all on function public.services_order_delivery_ratings(uuid[]) from public, anon;
grant execute on function public.services_order_delivery_ratings(uuid[]) to authenticated;
notify pgrst, 'reload schema';
select '194 order delivery ratings done' as "194";
