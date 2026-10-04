-- ===========================================================================
-- 118_part5.sql -- riders hear about new delivery jobs and ride requests
-- near them, and the passenger hears when a driver accepts.
-- ===========================================================================
create or replace function public.services_trg_job_new()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  p record;
begin
  select w.lat, w.lng into p from public.services_workers w where w.id = new.poster_work;
  if p.lat is null then return new; end if;
  perform public.services_notify(r.user_id, 'job_new', null)
    from (select w.user_id
            from public.services_workers w
            join public.services_trades t on t.slug = w.trade_slug and t.group_name = 'Drivers'
            join public.services_presence pr on pr.worker_id = w.id
           where w.status = 'approved' and pr.online_until > now()
             and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
             and public.services_km(pr.lat, pr.lng, p.lat, p.lng) <= 10
           limit 40) r;
  return new;
end;
$fn$;
drop trigger if exists services_job_new on public.services_jobs;
create trigger services_job_new after insert on public.services_jobs
  for each row execute function public.services_trg_job_new();

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
             and public.services_km(pr.lat, pr.lng, new.pick_lat, new.pick_lng) <= 8
           limit 40) r;
  return new;
end;
$fn$;
drop trigger if exists services_ride_new on public.services_rides;
create trigger services_ride_new after insert on public.services_rides
  for each row execute function public.services_trg_ride_new();

select 'part 5 of 6 done' as "118_part5";
