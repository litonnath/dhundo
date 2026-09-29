-- ===========================================================================
-- 87 part 1 of 2: AUDIT. Reads only, changes nothing.
-- How many places and listings sit at a doubtful position.
-- Send the result over.
-- ===========================================================================

create index if not exists services_regions_state_lplace
  on public.services_regions (state, lower(place));

with src as (
  select r.id, r.state, r.district, r.place, r.lat, r.lng,
         coalesce(to_jsonb(r) ->> 'source', '?') as source
    from public.services_regions r
),
post_vs_map as (
  select p.id,
         (select min(public.services_km(p.lat, p.lng, m.lat, m.lng))
            from public.services_regions m
           where m.state = p.state and lower(m.place) = lower(p.place)
             and coalesce(to_jsonb(m) ->> 'source', '') in ('osm', 'geonames')
             and m.lat is not null) as km
    from public.services_regions p
   where coalesce(to_jsonb(p) ->> 'source', '') = 'post' and p.lat is not null
),
w as (
  select w.locality, w.city, w.loc_source,
         public.services_km(w.lat, w.lng, c.lat, c.lng) as km_from_town
    from public.services_workers w
    join public.services_regions c on c.id = w.city_id
   where w.lat is not null and c.lat is not null
)
select jsonb_pretty(jsonb_build_object(
  'places_by_source', (select jsonb_object_agg(source, n) from
                        (select source, count(*) n from src group by 1) a),
  'places_without_position', (select count(*) from src where lat is null),
  'post_offices_with_same_name_on_map', (select count(*) from post_vs_map where km is not null),
  'of_those_more_than_5_km_apart', (select count(*) from post_vs_map where km > 5),
  'of_those_more_than_15_km_apart', (select count(*) from post_vs_map where km > 15),
  'workers_by_position_source', (select jsonb_object_agg(coalesce(loc_source, 'none'), n) from
                        (select loc_source, count(*) n from public.services_workers group by 1) b),
  'workers_more_than_20_km_from_their_town', (select count(*) from w where km_from_town > 20),
  'worst_workers', (select jsonb_agg(x) from (
      select locality, city, loc_source, round(km_from_town::numeric, 1) km_from_town
        from w order by km_from_town desc limit 10) x),
  'buy_sell_ads_without_position', (select count(*) from public.services_items where lat is null)
)) as "87_audit";
