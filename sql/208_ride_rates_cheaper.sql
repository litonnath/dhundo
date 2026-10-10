-- ===========================================================================
-- 208_ride_rates_cheaper.sql -- ride rates set below the big apps. For a short
-- 2.3 km trip at night those apps charge about 50 (bike), 97 (auto) and
-- 216 to 238 (cab). These give about 31, 50 and 92. Fare = max(minimum,
-- base + per km x distance); each driver may move the per-km rate by the band
-- (20%) either way. Change any of it in Admin > Fares & tax.
-- Run after 183_ride_rates_1.sql.
-- ===========================================================================
update public.services_rate_card set base_rupees = 15, per_km_rupees = 7,  min_rupees = 25, band_pct = 20 where key = 'ride_bike';
update public.services_rate_card set base_rupees = 25, per_km_rupees = 11, min_rupees = 35, band_pct = 20 where key = 'ride_auto';
update public.services_rate_card set base_rupees = 60, per_km_rupees = 14, min_rupees = 80, band_pct = 20 where key = 'ride_taxi';
select key, base_rupees, per_km_rupees, min_rupees from public.services_rate_card where key like 'ride_%' order by key;
