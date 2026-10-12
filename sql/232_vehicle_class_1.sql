-- 232_vehicle_class_1.sql -- car, taxi and cab are one category: a ride asked for a cab reaches every car,
-- taxi and cab driver. Part 1 of 2 (the class, and the list of requests a driver sees).
create or replace function public.services_vehicle_class(p_slug text)
returns text language sql immutable as $fn$
  select case
    when p_slug ~* '(bike|moto|scooter)' then 'bike'
    when p_slug ~* '(auto|rick|toto)' then 'auto'
    when p_slug ~* '(taxi|cab|(^|-)car($|-))' then 'cab'
    else p_slug end
$fn$;
drop function if exists public.services_rides_nearby();
create or replace function public.services_rides_nearby()
returns table (id uuid, pick_text text, drop_text text, vehicle text, fare_paise int,
               pick_km double precision, trip_km double precision,
               created_at timestamptz, expires_at timestamptz,
               pick_lat double precision, pick_lng double precision,
               drop_lat double precision, drop_lng double precision,
               my_lat double precision, my_lng double precision)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_lat double precision;
  v_lng double precision;
  v_slug text;
begin
  if v_me is null then return; end if;
  select pr.lat, pr.lng, w.trade_slug into v_lat, v_lng, v_slug
    from public.services_workers w
    join public.services_trades t on t.slug = w.trade_slug and t.group_name = 'Drivers'
    join public.services_presence pr on pr.worker_id = w.id
   where w.user_id = v_me and w.status = 'approved' and w.serves_rides
     and pr.online_until > now()
     and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
   limit 1;
  if v_lat is null then return; end if;
  return query
    select r.id, r.pick_text, r.drop_text, r.vehicle, r.fare_paise,
           round(public.services_km(v_lat, v_lng, r.pick_lat, r.pick_lng)::numeric, 1)::double precision,
           case when r.drop_lat is null then null
                else round(public.services_km(r.pick_lat, r.pick_lng, r.drop_lat, r.drop_lng)::numeric, 1)::double precision end,
           r.created_at, r.expires_at, r.pick_lat, r.pick_lng, r.drop_lat, r.drop_lng, v_lat, v_lng
      from public.services_rides r
     where r.status = 'open' and r.expires_at > now() and r.passenger_id <> v_me
       and (r.vehicle = 'any' or public.services_vehicle_class(r.vehicle) = public.services_vehicle_class(v_slug))
       and public.services_km(v_lat, v_lng, r.pick_lat, r.pick_lng) <= 8
     order by public.services_km(v_lat, v_lng, r.pick_lat, r.pick_lng), r.created_at desc
     limit 20;
end;
$fn$;
revoke all on function public.services_rides_nearby() from public, anon, authenticated;
grant execute on function public.services_rides_nearby() to authenticated;
notify pgrst, 'reload schema';
select '232 vehicle class part 1 done' as "232_1";
