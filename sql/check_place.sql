-- ===========================================================================
-- check_place.sql -- READ ONLY. Where a place and a listing are, and how far
-- apart. Change the two names in the first lines and run.
-- ===========================================================================
with q as (select 'padmapur'::text as place_name, 'Vasant til'::text as listing_name),
shop as (
  select w.business_name, w.full_name, w.locality, w.city, w.loc_source, w.lat, w.lng
    from public.services_workers w, q
   where w.business_name ilike q.listing_name or w.full_name ilike q.listing_name
   limit 1
)
select jsonb_pretty(jsonb_build_object(
  'listing', (select to_jsonb(shop) from shop),
  'places_named_like_that', (select jsonb_agg(x order by x.km_to_listing nulls last) from (
      select r.place, r.district, r.state,
             coalesce(to_jsonb(r) ->> 'source', '?') as source, r.lat, r.lng,
             round(public.services_km(r.lat, r.lng, s.lat, s.lng)::numeric, 1) as km_to_listing
        from public.services_regions r, q, shop s
       where r.place ilike q.place_name || '%' and r.lat is not null
       limit 30) x)
)) as "check_place";
