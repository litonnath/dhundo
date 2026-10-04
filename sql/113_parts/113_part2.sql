-- ===========================================================================
-- 113_part2.sql -- riders: jobs near me, and accepting one.
-- A rider is an approved listing in the Drivers group that is online now.
-- Jobs show no phone number; accepting shows the shop number and place.
-- ===========================================================================
create or replace function public.services_jobs_nearby()
returns table (id uuid, shop text, note text, drop_text text, fee_paise int,
               km double precision, created_at timestamptz, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_lat double precision;
  v_lng double precision;
begin
  if v_me is null then return; end if;
  select pr.lat, pr.lng into v_lat, v_lng
    from public.services_workers w
    join public.services_trades t on t.slug = w.trade_slug and t.group_name = 'Drivers'
    join public.services_presence pr on pr.worker_id = w.id
   where w.user_id = v_me and w.status = 'approved'
     and pr.online_until > now()
     and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
   limit 1;
  if v_lat is null then return; end if;
  return query
    select j.id, coalesce(nullif(btrim(p.business_name), ''), p.full_name)::text, j.note, j.drop_text,
           j.fee_paise,
           round(public.services_km(v_lat, v_lng, p.lat, p.lng)::numeric, 1)::double precision,
           j.created_at, j.expires_at
      from public.services_jobs j
      join public.services_workers p on p.id = j.poster_work
     where j.status = 'open' and j.expires_at > now()
       and p.lat is not null and public.services_km(v_lat, v_lng, p.lat, p.lng) <= 10
     order by j.created_at desc
     limit 20;
end;
$fn$;
revoke all on function public.services_jobs_nearby() from public, anon, authenticated;
grant execute on function public.services_jobs_nearby() to authenticated;

select 'part 2 of 4 done' as "113_part2";
