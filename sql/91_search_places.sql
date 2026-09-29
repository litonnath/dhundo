-- ===========================================================================
-- 91_search_places.sql
--
-- The area search (services_search_regions) returns a name, district and
-- kind but NO POSITION. So a village picked from "More places" came with no
-- latitude and longitude, and nothing could be measured from it: no
-- distance, and the PIN code only by guessing from the name.
--
-- services_search_places(state, query, limit): the same search, with the
-- position, the source and the PIN code nearest each place. Map places
-- (OpenStreetMap, GeoNames) come before post offices of the same name.
-- ===========================================================================

create index if not exists services_regions_state_lplace
  on public.services_regions (state, lower(place));

create or replace function public.services_search_places(
  p_state text, p_query text, p_limit int default 25)
returns table (place text, district text, block text, kind text, source text,
               lat double precision, lng double precision)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  with q as (select lower(btrim(coalesce(p_query, ''))) as s)
  select r.place, r.district,
         coalesce(to_jsonb(r) ->> 'block', null) as block,
         coalesce(to_jsonb(r) ->> 'kind', '') as kind,
         coalesce(to_jsonb(r) ->> 'source', '') as source,
         r.lat, r.lng
    from public.services_regions r, q
   where length(q.s) >= 2
     and (p_state is null or r.state = p_state)
     and lower(r.place) like q.s || '%'
   order by (lower(r.place) = q.s) desc,
            (coalesce(to_jsonb(r) ->> 'source', '') = 'post'),
            (r.lat is null),
            length(r.place), r.place
   limit greatest(1, least(coalesce(p_limit, 25), 50));
$fn$;

grant execute on function public.services_search_places(text, text, int) to anon, authenticated;

notify pgrst, 'reload schema';

select jsonb_pretty(jsonb_build_object(
  'tilthai', (select jsonb_agg(x) from public.services_search_places('Tripura', 'tilthai', 5) x),
  'expected', 'places named Tilthai with lat and lng'
)) as "91_verify";
