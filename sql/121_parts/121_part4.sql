-- ===========================================================================
-- 121_part4.sql -- the ride alerts follow the vehicle. Needs 118.
-- ===========================================================================
create or replace function public.services_trg_ride_new()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  perform public.services_notify(r.user_id, 'ride_new', null)
    from (select w.user_id
            from public.services_workers w
            join public.services_trades t on t.slug = w.trade_slug and t.group_name = 'Drivers'
            join public.services_presence pr on pr.worker_id = w.id
           where w.status = 'approved' and pr.online_until > now()
             and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
             and (new.vehicle = 'any' or new.vehicle = w.trade_slug)
             and public.services_km(pr.lat, pr.lng, new.pick_lat, new.pick_lng) <= 8
           limit 40) r;
  return new;
end;
$fn$;

notify pgrst, 'reload schema';
select 'part 4 of 4 done' as "121_part4";
