-- ===========================================================================
-- 87 part 2 of 2: FIX post office places.
-- Post office positions come from rough postal data. Where the same place
-- is on the map (OpenStreetMap or GeoNames) under the same name, or under
-- the first word of the name ("Tilthai" for "Tilthai Nutanbazar"), the
-- post office takes the map position: the same-named map place nearest to
-- it, and only within 40 km, so a village of the same name elsewhere in
-- the state is never used. Then run 85_parts/85_part2.sql again.
-- ===========================================================================

create index if not exists services_regions_state_lplace
  on public.services_regions (state, lower(place));

drop table if exists _87_fix;
create temporary table _87_fix as
select p.id, m.lat, m.lng, public.services_km(p.lat, p.lng, m.lat, m.lng) as moved_km
  from public.services_regions p
  cross join lateral (
    select r.lat, r.lng
      from public.services_regions r
     where r.state = p.state and r.lat is not null
       and (lower(r.place) = lower(p.place)
            or (length(split_part(p.place, ' ', 1)) >= 4
                and lower(r.place) = lower(split_part(p.place, ' ', 1))))
       and coalesce(to_jsonb(r) ->> 'source', '') in ('osm', 'geonames')
     order by (lower(r.place) = lower(p.place)) desc,
              public.services_km(p.lat, p.lng, r.lat, r.lng)
     limit 1) m
 where coalesce(to_jsonb(p) ->> 'source', '') = 'post'
   and p.lat is not null;

update public.services_regions r
   set lat = f.lat, lng = f.lng
  from _87_fix f
 where r.id = f.id and f.moved_km > 1 and f.moved_km <= 40;

notify pgrst, 'reload schema';

select jsonb_pretty(jsonb_build_object(
  'post_offices_matched_on_map', (select count(*) from _87_fix),
  'moved', (select count(*) from _87_fix where moved_km > 1 and moved_km <= 40),
  'moved_more_than_10_km', (select count(*) from _87_fix where moved_km > 10 and moved_km <= 40),
  'left_alone_too_far', (select count(*) from _87_fix where moved_km > 40),
  'next', 'run 85_parts/85_part2.sql again to place every listing'
)) as "87_fix";
