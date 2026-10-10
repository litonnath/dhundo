-- ===========================================================================
-- 182_delivery_quote.sql -- the delivery partner fee, worked out from distance,
-- as a RANGE the customer sees before ordering. The fee is the rate card's
-- max(minimum, base + per km x km), where km = the restaurant to the customer
-- plus the rider's trip to the restaurant beyond the first 2 km (road distance =
-- 1.3 x the straight line). The low end assumes a rider right at the restaurant;
-- the high end a rider 15 km away. The exact fee is set when a rider accepts.
-- Replaces services_delivery_quote / services_delivery_fee from 178.
-- Run after 178_delivery_fee_card.sql and 191_pricing_defaults.sql.
-- ===========================================================================
create or replace function public.services_fee_for_km(p_worker uuid, p_km numeric)
returns int
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select coalesce((
    select ceil(greatest(c.min_rupees, c.base_rupees + c.per_km_rupees * greatest(coalesce(p_km, 0), 0)))::int * 100
      from public.services_rate_card c
      join public.services_workers s on s.id = p_worker
      left join public.services_trades t on t.slug = s.trade_slug
     where c.key = case when t.group_name = 'Eat & Stay' then 'delivery_food' else 'delivery_small' end), 3000);
$fn$;
revoke all on function public.services_fee_for_km(uuid, numeric) from public, anon, authenticated;

drop function if exists public.services_delivery_quote(uuid, double precision, double precision);
create function public.services_delivery_quote(p_worker uuid, p_lat double precision, p_lng double precision)
returns table (pickup_km numeric, drop_km numeric, total_km numeric, fee_paise int, rider_found boolean,
               fee_min_paise int, fee_max_paise int)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  s record;
  v_drop numeric;
  v_pick numeric := 2.0;
  v_found boolean := false;
begin
  select w.lat, w.lng into s from public.services_workers w where w.id = p_worker;
  v_drop := case when s.lat is null or p_lat is null then 3.0
                 else round((1.3 * public.services_km(s.lat, s.lng, p_lat, p_lng))::numeric, 1) end;
  if s.lat is not null then
    select round((1.3 * min(public.services_km(pr.lat, pr.lng, s.lat, s.lng)))::numeric, 1) into v_pick
      from public.services_presence pr
      join public.services_workers rw on rw.id = pr.worker_id
     where rw.status = 'approved' and rw.serves_delivery
       and public.services_is_delivery_trade(rw.trade_slug)
       and pr.online_until > now()
       and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
       and public.services_km(pr.lat, pr.lng, s.lat, s.lng) <= 30;
    v_found := v_pick is not null;
    v_pick := coalesce(v_pick, 2.0);
  end if;
  return query select v_pick, v_drop, v_drop + greatest(0, v_pick - 2),
    public.services_fee_for_km(p_worker, v_drop + greatest(0, v_pick - 2)), v_found,
    public.services_fee_for_km(p_worker, v_drop),
    public.services_fee_for_km(p_worker, v_drop + 13);
end;
$fn$;
revoke all on function public.services_delivery_quote(uuid, double precision, double precision) from public;
grant execute on function public.services_delivery_quote(uuid, double precision, double precision) to anon, authenticated;

create or replace function public.services_delivery_fee(p_worker uuid, p_lat double precision, p_lng double precision)
returns int
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select q.fee_paise from public.services_delivery_quote(p_worker, p_lat, p_lng) q;
$fn$;
revoke all on function public.services_delivery_fee(uuid, double precision, double precision) from public, anon, authenticated;
notify pgrst, 'reload schema';
select '182 delivery quote done' as "182";
