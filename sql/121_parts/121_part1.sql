-- ===========================================================================
-- 121_part1.sql -- RIDES BY VEHICLE. A passenger picks the kind of vehicle they
-- need (car, taxi, auto, truck, bus, school van, delivery bike, tractor,
-- ambulance, excavator, crane) and only drivers who offer that vehicle see
-- the request. Needs 115.
-- ===========================================================================
alter table public.services_rides drop constraint if exists services_rides_vehicle_check;
alter table public.services_rides add constraint services_rides_vehicle_check check (char_length(vehicle) between 2 and 60);

create or replace function public.services_ride_request(
  p_pick_text text, p_pick_lat double precision, p_pick_lng double precision,
  p_drop_text text, p_drop_lat double precision, p_drop_lng double precision,
  p_vehicle text default 'any', p_fare_rupees int default null)
returns table (ok boolean, reason text, ride_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_id uuid;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text, null::uuid;
    return;
  end if;
  perform public.services_rate_guard('ride_request', v_me::text, 12, 3600);
  if p_pick_lat is null or p_pick_lng is null
     or length(btrim(coalesce(p_pick_text, ''))) < 2
     or length(btrim(coalesce(p_drop_text, ''))) < 2 then
    return query select false, 'bad_input'::text, null::uuid;
    return;
  end if;
  update public.services_rides set status = 'expired'
   where passenger_id = v_me and status = 'open' and expires_at <= now();
  if exists (select 1 from public.services_rides
              where passenger_id = v_me and status in ('open', 'accepted')) then
    return query select false, 'already_open'::text, null::uuid;
    return;
  end if;
  insert into public.services_rides (passenger_id, pick_text, pick_lat, pick_lng,
         drop_text, drop_lat, drop_lng, vehicle, fare_paise)
  values (v_me, left(btrim(p_pick_text), 200), p_pick_lat, p_pick_lng,
          left(btrim(p_drop_text), 200), p_drop_lat, p_drop_lng,
          case when exists (select 1 from public.services_trades t where t.slug = p_vehicle and t.group_name = 'Drivers')
               then p_vehicle else 'any' end,
          case when p_fare_rupees is null then null
               else least(greatest(p_fare_rupees, 0), 50000) * 100 end)
  returning id into v_id;
  return query select true, 'posted'::text, v_id;
end;
$fn$;
revoke all on function public.services_ride_request(text, double precision, double precision, text, double precision, double precision, text, int) from public, anon, authenticated;
grant execute on function public.services_ride_request(text, double precision, double precision, text, double precision, double precision, text, int) to authenticated;

select 'part 1 of 4 done' as "121_part1";
