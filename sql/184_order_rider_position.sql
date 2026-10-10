-- ===========================================================================
-- 184_order_rider_position.sql -- where the delivery rider is, for the customer
-- who ordered. Only that customer, only while the rider holds the job (accepted
-- or picked up), and only a position seen in the last 10 minutes. Also returns
-- the restaurant's and the customer's points so the map can draw the trip.
-- ===========================================================================
create or replace function public.services_order_rider_position(p_order uuid)
returns table (lat double precision, lng double precision, seen_at timestamptz,
               job_status text, shop_lat double precision, shop_lng double precision,
               drop_lat double precision, drop_lng double precision)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select case when pr.seen_at > now() - interval '10 minutes' then round(pr.lat::numeric, 5)::double precision end,
         case when pr.seen_at > now() - interval '10 minutes' then round(pr.lng::numeric, 5)::double precision end,
         pr.seen_at, j.status::text, s.lat, s.lng, o.lat, o.lng
    from public.services_orders o
    join public.services_jobs j on j.id = o.job_id and j.status in ('accepted', 'picked_up')
    join public.services_workers s on s.id = o.worker_id
    left join public.services_presence pr on pr.worker_id = j.rider_work
   where o.id = p_order and o.customer_id = public.services_account_id();
$fn$;
revoke all on function public.services_order_rider_position(uuid) from public, anon;
grant execute on function public.services_order_rider_position(uuid) to authenticated;
notify pgrst, 'reload schema';
select '184 order rider position done' as "184";
