-- ===========================================================================
-- 181_no_rider_fallback.sql -- when nobody takes a delivery job.
--  1. An unclaimed job is put out again, twice, for another 30 minutes each
--     time (the search circle starts again at 10 km and widens).
--  2. After that the order shows "no rider found", and either side can turn
--     it into a pickup order: the delivery charge and fee come off the bill.
-- Part 1: the retry. Run after 179_widen_radius_2.sql, then 181_no_rider_fallback_2.sql.
-- ===========================================================================
alter table public.services_jobs add column if not exists retries int not null default 0;

create or replace function public.services_jobs_retry()
returns int
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  j record;
  p record;
  v_n int := 0;
begin
  for j in
    select x.id, x.poster_work from public.services_jobs x
     where x.status = 'open' and x.expires_at <= now() and x.retries < 2
       and exists (select 1 from public.services_orders o
                    where o.job_id = x.id and o.status in ('accepted', 'ready'))
     limit 20
  loop
    update public.services_jobs
       set retries = retries + 1, created_at = now(), expires_at = now() + interval '30 minutes', widen_step = 0
     where id = j.id;
    select w.lat, nullif(btrim(w.pincode), '') as pin, w.city_id into p
      from public.services_workers w where w.id = j.poster_work;
    perform public.services_notify(r.user_id, 'job_new', null)
      from (select w.user_id
              from public.services_workers w
              join public.services_presence pr on pr.worker_id = w.id
             where w.status = 'approved' and w.serves_delivery
               and public.services_is_delivery_trade(w.trade_slug)
               and pr.online_until > now()
               and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
               and (case when p.lat is not null then public.services_km(pr.lat, pr.lng, p.lat, p.lng) <= 10
                         else (p.pin is not null and nullif(btrim(w.pincode), '') = p.pin)
                           or (p.city_id is not null and w.city_id = p.city_id) end)
             limit 40) r;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$fn$;
revoke all on function public.services_jobs_retry() from public, anon, authenticated;

notify pgrst, 'reload schema';
select '181 part 1 done' as "181_1";
