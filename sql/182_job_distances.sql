-- ===========================================================================
-- 182_job_distances.sql -- a job offered to a rider also says how far the
-- customer is from the restaurant (drop_km), next to how far the rider is from
-- the restaurant (km). Replaces services_jobs_nearby from 179. Run after 179_widen_radius_1.sql and 187_delivery_ratings.sql.
-- ===========================================================================
drop function if exists public.services_jobs_nearby();
create function public.services_jobs_nearby()
returns table (id uuid, shop text, note text, drop_text text, fee_paise int,
               km double precision, created_at timestamptz, expires_at timestamptz,
               drop_km double precision, cust_avg numeric, cust_n int)
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
           j.created_at, j.expires_at,
           case when p.lat is null or o.lat is null then null
                else round((1.3 * public.services_km(p.lat, p.lng, o.lat, o.lng))::numeric, 1)::double precision end,
           (select round(avg(x.stars)::numeric, 1) from public.services_delivery_ratings x where x.to_account = o.customer_id and x.by_role = 'rider'),
           (select count(*)::int from public.services_delivery_ratings x where x.to_account = o.customer_id and x.by_role = 'rider')
      from public.services_jobs j
      join public.services_workers p on p.id = j.poster_work
      left join public.services_orders o on o.job_id = j.id
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

revoke all on function public.services_jobs_nearby() from public, anon, authenticated;
grant execute on function public.services_jobs_nearby() to authenticated;
notify pgrst, 'reload schema';
select '182 job distances done' as "182_2";
