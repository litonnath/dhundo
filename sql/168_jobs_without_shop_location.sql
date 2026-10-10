-- ===========================================================================
-- 168_jobs_without_shop_location.sql -- delivery riders could not see an order
-- when the restaurant or shop had no map location (its position was empty),
-- so the job never reached anybody. Now such a job is shown to online delivery
-- riders in the same PIN code or city, and they are alerted too. A shop that
-- has a position works exactly as before (within 10 km, nearest first).
-- Replaces the two functions from 142 part 1. Run after 142.
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
       and ((p.lat is not null and public.services_km(v_lat, v_lng, p.lat, p.lng) <= 10)
         or (p.lat is null and ((v_pin is not null and nullif(btrim(p.pincode), '') = v_pin)
                             or (v_city is not null and p.city_id = v_city))))
     order by case when p.lat is null then 99999 else public.services_km(v_lat, v_lng, p.lat, p.lng) end, j.created_at desc
     limit 20;
end;
$fn$;
revoke all on function public.services_jobs_nearby() from public, anon, authenticated;
grant execute on function public.services_jobs_nearby() to authenticated;

create or replace function public.services_trg_job_new()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  p record;
begin
  select w.lat, w.lng, nullif(btrim(w.pincode), '') as pin, w.city_id into p
    from public.services_workers w where w.id = new.poster_work;
  perform public.services_notify(r.user_id, 'job_new', null)
    from (select w.user_id
            from public.services_workers w
            join public.services_presence pr on pr.worker_id = w.id
           where w.status = 'approved' and w.serves_delivery
             and public.services_is_delivery_trade(w.trade_slug)
             and pr.online_until > now()
             and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
             and (case when p.lat is not null
                       then public.services_km(pr.lat, pr.lng, p.lat, p.lng) <= 10
                       else (p.pin is not null and nullif(btrim(w.pincode), '') = p.pin)
                         or (p.city_id is not null and w.city_id = p.city_id) end)
           limit 40) r;
  return new;
end;
$fn$;
notify pgrst, 'reload schema';
select '168 jobs without shop location done' as "168";
