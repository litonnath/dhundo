-- ===========================================================================
-- 191_pricing_defaults.sql -- GST is 5% on restaurant food and 18% on shop goods, and the
-- delivery fee follows a distance rate like other food apps: about 30 rupees for
-- 5.5 km (8 + 4 per km, at least 20). Medium / bulky and heavy rows are only
-- changed if they still have their first values. All of these can be edited in
-- the admin console (Fares & tax). Run after 157/158 and 163_gst_rates.sql.
-- ===========================================================================
update public.services_gst_rates set percent = case when kind = 'restaurant' then 5 else 18 end;
update public.services_rate_card set base_rupees = 8, per_km_rupees = 4, min_rupees = 20
 where key in ('delivery_food', 'delivery_small');
update public.services_rate_card set base_rupees = 20, per_km_rupees = 5, min_rupees = 40
 where key = 'delivery_medium' and (base_rupees, per_km_rupees, min_rupees) = (40, 10, 60);
update public.services_rate_card set base_rupees = 60, per_km_rupees = 10, min_rupees = 120
 where key = 'delivery_heavy' and (base_rupees, per_km_rupees, min_rupees) = (120, 18, 200);
select '191 pricing defaults done' as "191";
