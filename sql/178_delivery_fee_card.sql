-- ===========================================================================
-- 178_delivery_fee_card.sql -- the delivery fee the customer pays, which goes
-- to the rider in full, now comes from the admin's rate card (restaurant food
-- or shop small-items row): max(minimum, base + per km x road km), with the
-- road distance 1.3 x the straight line, or 3 km when a position is missing.
-- An order that reaches the database with a delivery fee of 0 gets it filled in.
-- Replaces services_delivery_fee (143 part 1) and the 164 charges trigger.
-- Run after 164_order_charges.sql and 158_rate_card_gst.sql.
-- ===========================================================================
create or replace function public.services_delivery_fee(p_worker uuid, p_lat double precision, p_lng double precision)
returns int
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select coalesce((
    select ceil(greatest(c.min_rupees, c.base_rupees + c.per_km_rupees * k.km))::int * 100
      from public.services_rate_card c where c.key = k.key), 3000)
    from (select case when s.lat is null or p_lat is null then 3.0
                      else 1.3 * public.services_km(s.lat, s.lng, p_lat, p_lng) end as km,
                  case when t.group_name = 'Eat & Stay' then 'delivery_food' else 'delivery_small' end as key
            from public.services_workers s
            left join public.services_trades t on t.slug = s.trade_slug
           where s.id = p_worker) k;
$fn$;
revoke all on function public.services_delivery_fee(uuid, double precision, double precision) from public, anon, authenticated;

create or replace function public.services_order_charges()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_group text; v_pct numeric := 0; v_card record;
begin
  select t.group_name into v_group from public.services_workers w
    left join public.services_trades t on t.slug = w.trade_slug where w.id = new.worker_id;
  if tg_op = 'INSERT' then
    select g.percent into v_pct from public.services_gst_rates g
     where g.kind = case when v_group = 'Eat & Stay' then 'restaurant' else 'shop' end;
    new.gst_paise := round(new.total_paise * coalesce(v_pct, 0) / 100)::int;
  end if;
  if new.mode = 'delivery' and new.delivery_fee_paise = 0 then
    new.delivery_fee_paise := public.services_delivery_fee(new.worker_id, new.lat, new.lng);
  end if;
  if new.mode = 'pickup' then
    new.misc_fee_paise := 0; new.misc_gst_paise := 0;
  elsif new.misc_fee_paise = 0 then
    select c.platform_rupees, c.gst_percent into v_card from public.services_rate_card c
     where c.key = case when v_group = 'Eat & Stay' then 'delivery_food' else 'delivery_small' end;
    new.misc_fee_paise := coalesce(v_card.platform_rupees, 0) * 100;
    new.misc_gst_paise := round(new.misc_fee_paise * coalesce(v_card.gst_percent, 18) / 100)::int;
  end if;
  new.delivery_gst_paise := 0;
  return new;
end;
$fn$;
notify pgrst, 'reload schema';
select '178 delivery fee card done' as "178";
