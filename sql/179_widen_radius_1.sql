-- ===========================================================================
-- 179_widen_radius_1.sql -- a delivery job that nobody takes reaches farther
-- riders: it starts at 10 km around the shop and grows by 5 km every 3 minutes
-- it stays open, up to 30 km. Replaces services_jobs_nearby from 168.
-- Run after 168, then 179_widen_radius_2.sql.
-- ===========================================================================
alter table public.services_jobs add column if not exists widen_step int not null default 0;

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
  v_pin text;
  v_city bigint;
begin
  if v_me is null then return; end if;
  select pr.lat, pr.lng, nullif(btrim(w.pincode), ''), w.city_id into v_lat, v_lng, v_pin, v_city
    from public.services_workers w
    join public.services_presence pr on pr.worker_id = w.id
   where w.user_id = v_me and w.status = 'approved' and w.serves_delivery
     and public.services_is_delivery_trade(w.trade_slug)
     and pr.online_until > now()
     and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
   limit 1;
  if v_lat is null then return; end if;
  return query
    select j.id, coalesce(nullif(btrim(p.business_name), ''), p.full_name)::text, j.note, j.drop_text,
           j.fee_paise,
           case when p.lat is null then null
                else round(public.services_km(v_lat, v_lng, p.lat, p.lng)::numeric, 1)::double precision end,
           j.created_at, j.expires_at
      from public.services_jobs j
      join public.services_workers p on p.id = j.poster_work
     where j.status = 'open' and j.expires_at > now()
       and ((p.lat is not null and public.services_km(v_lat, v_lng, p.lat, p.lng)
               <= least(10 + 5 * floor(extract(epoch from (now() - j.created_at)) / 180), 30))
         or (p.lat is null and ((v_pin is not null and nullif(btrim(p.pincode), '') = v_pin)
                             or (v_city is not null and p.city_id = v_city))))
     order by case when p.lat is null then 99999 else public.services_km(v_lat, v_lng, p.lat, p.lng) end, j.created_at desc
     limit 20;
end;
$fn$;
revoke all on function public.services_jobs_nearby() from public, anon, authenticated;
grant execute on function public.services_jobs_nearby() to authenticated;

notify pgrst, 'reload schema';
select '179 part 1 done' as "179_1";
