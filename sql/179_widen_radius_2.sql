-- ===========================================================================
-- 179_widen_radius_2.sql -- when an open delivery job's search circle grows,
-- the riders in the new ring are alerted. Done by services_orders_release_due,
-- which the app already calls every few seconds (and pg_cron can call). Run
-- after 172_rider_timing_1.sql and 179_widen_radius_1.sql.
-- ===========================================================================
create or replace function public.services_jobs_widen()
returns int
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  j record;
  v_step int;
  v_n int := 0;
begin
  for j in
    select x.id, x.widen_step, x.created_at, p.lat, p.lng
      from public.services_jobs x
      join public.services_workers p on p.id = x.poster_work
     where x.status = 'open' and x.expires_at > now() and p.lat is not null
       and x.created_at < now() - interval '3 minutes'
     limit 20
  loop
    v_step := least(floor(extract(epoch from (now() - j.created_at)) / 180)::int, 4);
    continue when v_step <= j.widen_step;
    update public.services_jobs set widen_step = v_step where id = j.id;
    perform public.services_notify(r.user_id, 'job_new', null)
      from (select w.user_id
              from public.services_workers w
              join public.services_presence pr on pr.worker_id = w.id
             where w.status = 'approved' and w.serves_delivery
               and public.services_is_delivery_trade(w.trade_slug)
               and pr.online_until > now()
               and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
               and public.services_km(pr.lat, pr.lng, j.lat, j.lng) <= 10 + 5 * v_step
               and public.services_km(pr.lat, pr.lng, j.lat, j.lng) > 10 + 5 * (v_step - 1)
             limit 40) r;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$fn$;
revoke all on function public.services_jobs_widen() from public, anon, authenticated;

create or replace function public.services_orders_release_due()
returns int
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select x.id from public.services_orders x
     where x.mode = 'delivery' and x.status = 'accepted' and x.job_id is null
       and x.rider_after is not null and x.rider_after <= now()
     order by x.rider_after limit 20
  loop
    if public.services_order_post_job(r.id) is not null then v_n := v_n + 1; end if;
  end loop;
  perform public.services_jobs_widen();
  return v_n;
end;
$fn$;
revoke all on function public.services_orders_release_due() from public, anon;
grant execute on function public.services_orders_release_due() to authenticated;
notify pgrst, 'reload schema';
select '179 part 2 done' as "179_2";
