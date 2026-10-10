-- ===========================================================================
-- 183_ride_rates_2.sql -- a driver no longer types one price: they pick a
-- per-km RANGE (from / to) inside the admin's band for their vehicle (bike taxi,
-- auto, cab / taxi). Anything outside the band is moved to its edge. The middle
-- of the range is kept as per_km_rupees, which the passenger side already reads.
-- Replaces services_my_rider and services_set_rider from 120 part 4.
-- Run after 183_ride_rates_1.sql.
-- ===========================================================================
alter table public.services_workers
  add column if not exists per_km_min int check (per_km_min is null or per_km_min between 0 and 500),
  add column if not exists per_km_max int check (per_km_max is null or per_km_max between 0 and 500);

drop function if exists public.services_my_rider();
create function public.services_my_rider()
returns table (per_km_rupees int, serves_rides boolean, serves_delivery boolean,
               per_km_min int, per_km_max int, trade_slug text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.per_km_rupees, w.serves_rides, w.serves_delivery, w.per_km_min, w.per_km_max, w.trade_slug::text
    from public.services_workers w
   where w.user_id = public.services_account_id() and w.status in ('approved', 'pending')
   limit 1;
$fn$;
revoke all on function public.services_my_rider() from public, anon, authenticated;
grant execute on function public.services_my_rider() to authenticated;

drop function if exists public.services_set_rider(int, boolean, boolean);
create function public.services_set_rider(p_per_km_min int, p_per_km_max int, p_rides boolean, p_delivery boolean)
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_slug text;
  v_key text;
  c record;
  v_lo int;
  v_hi int;
  v_n int;
begin
  select w.trade_slug into v_slug from public.services_workers w
   where w.user_id = public.services_account_id() and w.status in ('approved', 'pending') limit 1;
  v_key := case when v_slug ~* 'deliver' then 'delivery_food'
                when v_slug ~* 'bike|moto|scooter' then 'ride_bike'
                when v_slug ~* 'auto|rick|toto' then 'ride_auto'
                when v_slug ~* 'taxi|cab|car' then 'ride_taxi' end;
  select r.per_km_rupees, r.band_pct into c from public.services_rate_card r where r.key = v_key;
  if c.per_km_rupees is not null and p_per_km_min is not null and p_per_km_max is not null then
    v_lo := ceil(c.per_km_rupees * (100 - c.band_pct) / 100.0)::int;
    v_hi := floor(c.per_km_rupees * (100 + c.band_pct) / 100.0)::int;
    p_per_km_min := least(greatest(p_per_km_min, v_lo), v_hi);
    p_per_km_max := least(greatest(p_per_km_max, p_per_km_min), v_hi);
  else
    p_per_km_min := null; p_per_km_max := null;
  end if;
  update public.services_workers
     set per_km_min = p_per_km_min, per_km_max = p_per_km_max,
         per_km_rupees = case when p_per_km_min is null then per_km_rupees
                              else round((p_per_km_min + p_per_km_max) / 2.0)::int end,
         serves_rides = coalesce(p_rides, true), serves_delivery = coalesce(p_delivery, true)
   where user_id = public.services_account_id() and status in ('approved', 'pending');
  get diagnostics v_n = row_count;
  return query select v_n > 0;
end;
$fn$;
revoke all on function public.services_set_rider(int, int, boolean, boolean) from public, anon, authenticated;
grant execute on function public.services_set_rider(int, int, boolean, boolean) to authenticated;
notify pgrst, 'reload schema';
select '183 part 2 done' as "183_2";
