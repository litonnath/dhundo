-- ===========================================================================
-- 115_part5.sql -- my ride, as passenger or driver. The other side name,
-- number and vehicle show once a ride is accepted.
-- ===========================================================================
create or replace function public.services_my_ride()
returns table (id uuid, role text, status text, pick_text text, drop_text text,
               pick_lat double precision, pick_lng double precision,
               drop_lat double precision, drop_lng double precision,
               vehicle text, fare_paise int, created_at timestamptz, expires_at timestamptz,
               other_name text, other_phone text, other_vehicle text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  (select r.id, 'passenger'::text, r.status, r.pick_text, r.drop_text, r.pick_lat, r.pick_lng,
          r.drop_lat, r.drop_lng, r.vehicle, r.fare_paise, r.created_at, r.expires_at,
          w.full_name::text,
          case when r.status = 'accepted' then w.phone::text end,
          case when r.status = 'accepted' then w.vehicle_number::text end
     from public.services_rides r
     left join public.services_workers w on w.id = r.driver_work
    where r.passenger_id = public.services_account_id()
      and (r.status = 'accepted' or (r.status = 'open' and r.expires_at > now()))
    order by r.created_at desc limit 1)
  union all
  (select r.id, 'driver'::text, r.status, r.pick_text, r.drop_text, r.pick_lat, r.pick_lng,
          r.drop_lat, r.drop_lng, r.vehicle, r.fare_paise, r.created_at, r.expires_at,
          s.full_name::text, s.phone::text, null::text
     from public.services_rides r
     join public.services_workers w on w.id = r.driver_work and w.user_id = public.services_account_id()
     join public.services_signups s on s.id = r.passenger_id
    where r.status = 'accepted'
    order by r.created_at desc limit 1);
$fn$;
revoke all on function public.services_my_ride() from public, anon, authenticated;
grant execute on function public.services_my_ride() to authenticated;

notify pgrst, 'reload schema';
select 'part 5 of 6 done' as "115_part5";
