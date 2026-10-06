-- 143 part 1: the delivery fee. 10 rupees a km (road estimate: 1.3 times the
-- straight line from the restaurant to the customer), at least 20 rupees. Worked
-- out here, never taken from the phone, stored on the order, and the same amount
-- goes to the rider. Run the four parts in order.
create or replace function public.services_delivery_fee(p_worker uuid, p_lat double precision, p_lng double precision)
returns int
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select case when s.lat is null or p_lat is null then 3000
              else greatest(2000, round(public.services_km(s.lat, s.lng, p_lat, p_lng)::numeric * 1.3 * 1000)::int) end
    from public.services_workers s where s.id = p_worker;
$fn$;
revoke all on function public.services_delivery_fee(uuid, double precision, double precision) from public, anon, authenticated;

alter table public.services_orders add column if not exists delivery_fee_paise int not null default 0;
notify pgrst, 'reload schema';
select 'part 1 of 4 done' as "143_part1";
