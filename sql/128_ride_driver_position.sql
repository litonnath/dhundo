-- ===========================================================================
-- 128_ride_driver_position.sql -- the passenger whose ride a driver has accepted
-- can see that driver on the map while the ride is on. Nobody else, and only
-- while the ride is accepted: a driver position stays private otherwise.
-- ===========================================================================
drop function if exists public.services_ride_driver_position(uuid);
create function public.services_ride_driver_position(p_ride uuid)
returns table (lat double precision, lng double precision, seen_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select p.lat, p.lng, p.seen_at
    from public.services_rides r
    join public.services_presence p on p.worker_id = r.driver_work
   where r.id = p_ride and r.status = 'accepted'
     and r.passenger_id = public.services_account_id()
     and p.online_until > now() and p.seen_at > now() - interval '10 minutes';
$fn$;
revoke all on function public.services_ride_driver_position(uuid) from public, anon, authenticated;
grant execute on function public.services_ride_driver_position(uuid) to authenticated;
notify pgrst, 'reload schema';
select 'done' as "128_ride_driver_position";
