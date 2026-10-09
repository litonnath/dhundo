-- ===========================================================================
-- 164_order_charges.sql -- run after 163_gst_rates.sql, before 164_orders_gst.sql.
-- The extra charges a CUSTOMER pays are saved on the order when it is made, so
-- changing a rate later never changes an old order:
--   gst_paise          GST on the items (restaurant / shop rate)
--   delivery_gst_paise 18% GST on the delivery charge
--   misc_fee_paise     Dhundo's small miscellaneous fee (delivery orders)
--   misc_gst_paise     GST on that fee
-- A trigger fills them, so no order function has to change. Shops, restaurants
-- and riders are never charged: their money is unchanged.
-- ===========================================================================
alter table public.services_orders
  add column if not exists gst_paise int not null default 0,
  add column if not exists delivery_gst_paise int not null default 0,
  add column if not exists misc_fee_paise int not null default 0,
  add column if not exists misc_gst_paise int not null default 0;

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
  if new.mode = 'pickup' then
    new.misc_fee_paise := 0; new.misc_gst_paise := 0;
  elsif new.misc_fee_paise = 0 then
    select c.platform_rupees, c.gst_percent into v_card from public.services_rate_card c
     where c.key = case when v_group = 'Eat & Stay' then 'delivery_food' else 'delivery_small' end;
    new.misc_fee_paise := coalesce(v_card.platform_rupees, 0) * 100;
    new.misc_gst_paise := round(new.misc_fee_paise * coalesce(v_card.gst_percent, 18) / 100)::int;
  end if;
  new.delivery_gst_paise := case when new.mode = 'pickup' then 0
                                 else round(new.delivery_fee_paise * 0.18)::int end;
  return new;
end;
$fn$;
drop trigger if exists services_order_charges_trg on public.services_orders;
create trigger services_order_charges_trg
  before insert or update of mode, delivery_fee_paise on public.services_orders
  for each row execute function public.services_order_charges();

-- Orders already placed: GST on the items at today's rates, once.
update public.services_orders o
   set gst_paise = round(o.total_paise * coalesce((
         select g.percent from public.services_gst_rates g
           join public.services_workers w on w.id = o.worker_id
           left join public.services_trades t on t.slug = w.trade_slug
          where g.kind = case when t.group_name = 'Eat & Stay' then 'restaurant' else 'shop' end), 0) / 100)::int
 where o.gst_paise = 0;
notify pgrst, 'reload schema';
select '164 order charges done' as "164";
