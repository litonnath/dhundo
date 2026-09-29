-- ===========================================================================
-- 88_nearest_places.sql
--
-- "Use my location" named the TOWN (Panisagar) for somebody standing in a
-- village (Tilthai). The phone position was right; the name came from the
-- map service, which names the nearest mapped town when a village is only a
-- dot on the map. The place table here has every village and locality with
-- a position, so the app now asks it for the places nearest the phone and
-- names the closest village.
--
-- services_nearest_places(lat, lng): the nearest places within about 5 km,
-- nearest first, with how far each is.
-- ===========================================================================

create index if not exists services_regions_latlng
  on public.services_regions (lat, lng) where lat is not null;

create or replace function public.services_nearest_places(
  p_lat double precision, p_lng double precision, p_limit int default 8)
returns table (place text, district text, state text, kind text, source text, km double precision)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.place, r.district, r.state,
         coalesce(to_jsonb(r) ->> 'kind', '') as kind,
         coalesce(to_jsonb(r) ->> 'source', '') as source,
         round(public.services_km(p_lat, p_lng, r.lat, r.lng)::numeric, 2)::double precision as km
    from public.services_regions r
   where p_lat is not null and p_lng is not null
     and r.lat between p_lat - 0.05 and p_lat + 0.05
     and r.lng between p_lng - 0.05 and p_lng + 0.05
   order by public.services_km(p_lat, p_lng, r.lat, r.lng)
   limit greatest(1, least(coalesce(p_limit, 8), 20));
$fn$;

grant execute on function public.services_nearest_places(double precision, double precision, int)
  to anon, authenticated;

notify pgrst, 'reload schema';

select jsonb_pretty(jsonb_build_object(
  'near_tilthai_example', (select jsonb_agg(x) from (
      select place, district, kind, source, km
        from public.services_nearest_places(24.315, 92.135, 6)) x),
  'expected', 'a list of places near that point, nearest first'
)) as "88_verify";
