-- ===========================================================================
-- 118_part6.sql -- the passenger hears when a driver accepts the ride.
-- ===========================================================================
create or replace function public.services_trg_ride_accepted()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.services_notify(new.passenger_id, 'ride_accepted', null);
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_ride_accepted on public.services_rides;
create trigger services_ride_accepted after update on public.services_rides
  for each row execute function public.services_trg_ride_accepted();

notify pgrst, 'reload schema';
select 'part 6 of 6 done' as "118_part6";
