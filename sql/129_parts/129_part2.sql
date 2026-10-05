-- ===========================================================================
-- 129_part2.sql -- keep alerting drivers about a ride request nobody has taken
-- yet: once a minute for six minutes, to each online driver near the pickup.
-- Run the function from a one-minute schedule (see the end of this file).
-- ===========================================================================
create or replace function public.services_renotify_rides()
returns int
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  r record;
  d record;
  n int := 0;
begin
  for r in
    select * from public.services_rides
     where status = 'open' and expires_at > now() and renotified < 6
       and created_at < now() - make_interval(mins => renotified + 1)
  loop
    for d in
      select w.user_id,
             round(public.services_km(pr.lat, pr.lng, r.pick_lat, r.pick_lng)::numeric, 1) as km
        from public.services_workers w
        join public.services_trades t on t.slug = w.trade_slug and t.group_name = 'Drivers'
        join public.services_presence pr on pr.worker_id = w.id
       where w.status = 'approved' and pr.online_until > now()
         and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
         and (r.vehicle = 'any' or r.vehicle = w.trade_slug)
         and public.services_km(pr.lat, pr.lng, r.pick_lat, r.pick_lng) <= 8
       limit 40
    loop
      perform public.services_notify(d.user_id, 'ride_new', r.id::text || '|' || d.km::text);
      n := n + 1;
    end loop;
    update public.services_rides set renotified = renotified + 1 where id = r.id;
  end loop;
  return n;
end;
$fn$;
revoke all on function public.services_renotify_rides() from public, anon, authenticated;

-- To run it every minute, turn on the pg_cron extension (Database, Extensions)
-- and then run this one line once:
--   select cron.schedule('dhundo-renotify-rides', '* * * * *', 'select public.services_renotify_rides()');
select 'part 2 of 2 done' as "129_part2";
