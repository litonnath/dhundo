-- ===========================================================================
-- 182_delivery_quote.sql -- the delivery fee from three distances, as on food
-- apps: (1) the nearest online delivery rider to the restaurant, (2) the
-- restaurant to the customer, (3) the total trip. The fee is the rate card's
-- max(minimum, base + per km x total km), and the customer sees it before
-- ordering. The rider gets all of it. Road distance = 1.3 x the straight line.
-- No online rider within 30 km counts as 2 km; a missing position as 3 km.
-- Replaces services_delivery_fee from 178. Run after 178_delivery_fee_card.sql.
-- ===========================================================================
create or replace function public.services_delivery_quote(p_worker uuid, p_lat double precision, p_lng double precision)
returns table (pickup_km numeric, drop_km numeric, total_km numeric, fee_paise int, rider_found boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  s record;
  v_group text;
  v_drop numeric;
  v_pick numeric;
  v_found boolean := false;
  c record;
  v_total numeric;
begin
  select w.lat, w.lng, w.trade_slug into s from public.services_workers w where w.id = p_worker;
  select t.group_name into v_group from public.services_trades t where t.slug = s.trade_slug;
  v_drop := case when s.lat is null or p_lat is null then 3.0
                 else round((1.3 * public.services_km(s.lat, s.lng, p_lat, p_lng))::numeric, 1) end;
  v_pick := 2.0;
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
  v_total := v_pick + v_drop;
  select r.min_rupees, r.base_rupees, r.per_km_rupees into c from public.services_rate_card r
   where r.key = case when v_group = 'Eat & Stay' then 'delivery_food' else 'delivery_small' end;
  return query select v_pick, v_drop, v_total,
    case when c.base_rupees is null then 3000
         else ceil(greatest(c.min_rupees, c.base_rupees + c.per_km_rupees * v_total))::int * 100 end,
    v_found;
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
