-- 133: where drivers are right now, for the map a passenger sees while looking
-- for a ride. Only drivers who are online with a recent position, only the
-- Drivers group, rounded to about 10 metres. Offline drivers are not returned.
create or replace function public.services_live_driver_positions(p_ids uuid[])
returns table (id uuid, lat double precision, lng double precision, seen_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.id, round(p.lat::numeric, 4)::double precision, round(p.lng::numeric, 4)::double precision, p.seen_at
    from public.services_workers w
    join public.services_trades t on t.slug = w.trade_slug and t.group_name = 'Drivers'
    join public.services_presence p on p.worker_id = w.id
   where w.id = any (coalesce(p_ids, '{}'::uuid[]))
     and w.status = 'approved' and w.serves_rides
     and p.online_until > now()
     and p.seen_at > now() - interval '10 minutes'
   limit 25;
$fn$;
revoke all on function public.services_live_driver_positions(uuid[]) from public;
grant execute on function public.services_live_driver_positions(uuid[]) to anon, authenticated;
notify pgrst, 'reload schema';
select 'done' as "133";
