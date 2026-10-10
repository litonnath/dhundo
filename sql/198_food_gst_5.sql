-- ===========================================================================
-- 198_food_gst_5.sql -- GST on restaurant food is 5%. Shops stay at 18%.
-- Orders that are still open are re-priced; delivered and cancelled orders
-- keep what the customer was billed. The admin can change either rate later
-- in Fares & tax.
-- ===========================================================================
update public.services_gst_rates set percent = 5 where kind = 'restaurant';
update public.services_orders o
   set gst_paise = round(o.total_paise * 5 / 100.0)::int
  from public.services_workers w
  left join public.services_trades t on t.slug = w.trade_slug
 where w.id = o.worker_id and t.group_name = 'Eat & Stay'
   and o.status not in ('delivered', 'cancelled');
select '198 food gst done' as "198";
