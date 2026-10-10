-- 169: no GST on the rider's delivery charge. GST is charged once, on the items
-- and on Dhundo's miscellaneous fee. Run after 164_order_charges.sql if you ran
-- an earlier copy of it (safe to run again).
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
  new.delivery_gst_paise := 0; -- no GST on the rider's delivery charge
  return new;
end;
$fn$;
update public.services_orders set delivery_gst_paise = 0 where delivery_gst_paise <> 0;
notify pgrst, 'reload schema';
select '169 no delivery gst done' as "169";
