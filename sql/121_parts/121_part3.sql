-- ===========================================================================
-- 121_part3.sql -- accepting a ride follows the vehicle too.
-- ===========================================================================
create or replace function public.services_ride_accept(p_ride uuid)
returns table (ok boolean, reason text, passenger text, phone text,
               pick_lat double precision, pick_lng double precision)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_drv uuid;
  v_pass uuid;
  v_slug text;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text, null::text, null::text, null::double precision, null::double precision;
    return;
  end if;
  perform public.services_rate_guard('ride_accept', v_me::text, 60, 3600);
  select w.id, w.trade_slug into v_drv, v_slug
    from public.services_workers w
    join public.services_trades t on t.slug = w.trade_slug and t.group_name = 'Drivers'
    join public.services_presence pr on pr.worker_id = w.id
   where w.user_id = v_me and w.status = 'approved' and pr.online_until > now()
   limit 1;
  if v_drv is null then
    return query select false, 'not_online'::text, null::text, null::text, null::double precision, null::double precision;
    return;
  end if;
  update public.services_rides r
     set status = 'accepted', driver_work = v_drv, accepted_at = now()
   where r.id = p_ride and r.status = 'open' and r.expires_at > now()
     and r.passenger_id <> v_me and (r.vehicle = 'any' or r.vehicle = v_slug)
     and exists (select 1 from public.services_presence pr
                  where pr.worker_id = v_drv
                    and public.services_km(pr.lat, pr.lng, r.pick_lat, r.pick_lng) <= 8)
   returning r.passenger_id into v_pass;
  if v_pass is null then
    return query select false, 'taken'::text, null::text, null::text, null::double precision, null::double precision;
    return;
  end if;
  return query
    select true, 'accepted'::text, s.full_name::text, s.phone::text, r.pick_lat, r.pick_lng
      from public.services_rides r
      join public.services_signups s on s.id = r.passenger_id
     where r.id = p_ride;
end;
$fn$;
revoke all on function public.services_ride_accept(uuid) from public, anon, authenticated;
grant execute on function public.services_ride_accept(uuid) to authenticated;

select 'part 3 of 4 done' as "121_part3";
