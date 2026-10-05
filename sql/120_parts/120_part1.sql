-- ===========================================================================
-- 120_part1.sql -- SHOP, RESTAURANT AND RIDER EXTRAS. A shop or restaurant can
-- post an offer (words and a picture) that customers see first. A rider sets
-- a fare per kilometre and chooses whether to take rides, deliveries or both.
-- Needs 113, 115, 116, 117.
-- ===========================================================================
alter table public.services_workers
  add column if not exists promo_text text check (promo_text is null or char_length(promo_text) <= 140),
  add column if not exists promo_photo text check (promo_photo is null or (char_length(promo_photo) <= 500 and promo_photo like 'https://%')),
  add column if not exists per_km_rupees int check (per_km_rupees is null or per_km_rupees between 0 and 500),
  add column if not exists serves_rides boolean not null default true,
  add column if not exists serves_delivery boolean not null default true;

select 'part 1 of 8 done' as "120_part1";
