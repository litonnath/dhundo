-- 137: a ride accepted before 136 has no code. Asking for the code now makes
-- one if it is missing, so those rides work too. Replaces the function in 136.
drop function if exists public.services_ride_code(uuid);
create function public.services_ride_code(p_ride uuid)
returns table (code text, started boolean, is_driver boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  update public.services_rides r
     set pickup_code = lpad((floor(random() * 10000))::int::text, 4, '0')
   where r.id = p_ride and r.status = 'accepted' and r.pickup_code is null
     and r.started_at is null;
  return query
    select case when r.passenger_id = v_me then r.pickup_code else null end,
           r.started_at is not null,
           r.passenger_id <> v_me
      from public.services_rides r
      left join public.services_workers w on w.id = r.driver_work
     where r.id = p_ride and r.status = 'accepted'
       and (r.passenger_id = v_me or w.user_id = v_me);
end;
$fn$;
revoke all on function public.services_ride_code(uuid) from public, anon, authenticated;
grant execute on function public.services_ride_code(uuid) to authenticated;
notify pgrst, 'reload schema';
select 'done' as "137";
