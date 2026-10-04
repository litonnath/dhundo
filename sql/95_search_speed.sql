-- ===========================================================================
-- 95_search_speed.sql
--
-- FIXES: place search failing with
--   57014  canceling statement due to statement timeout
-- so a village that IS in the table (Tilthai) never came back, and the search
-- fell through to a map service that has never heard of it.
--
-- Why it was slow: the search is a prefix match on the place name.
-- On a database with an ordinary language collation (Supabase is one) the
-- usual index cannot serve LIKE, so every place in the state was read and
-- compared one by one -- and with no state, the whole table. After the
-- all-India import that is millions of rows.
--
-- What this does:
--   1. prefix indexes (text_pattern_ops), which LIKE can use;
--   2. the search finds the few matching ids FIRST, and only then reads those
--      rows, instead of computing a JSON copy of every candidate row.
-- Building the indexes on a big table can take a little while; the first
-- line lets the editor wait for it.
-- ===========================================================================
set statement_timeout = 0;

create index if not exists services_regions_prefix_state
  on public.services_regions (state, lower(place) text_pattern_ops);
create index if not exists services_regions_prefix_all
  on public.services_regions (lower(place) text_pattern_ops);

do $b$
begin
  if to_regclass('public.services_post_offices') is not null then
    execute 'create index if not exists services_post_offices_prefix
               on public.services_post_offices (state, lower(name) text_pattern_ops)';
  end if;
end $b$;

analyze public.services_regions;

create or replace function public.services_search_places(
  p_state text, p_query text, p_limit int default 25)
returns table (place text, district text, block text, kind text, source text,
               lat double precision, lng double precision)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  -- The prefix as a range (tilthai up to, not including, tilthaj): written
  -- out like this an index can always serve it, and with the two bounds
  -- fixed first the planner knows the range is small. One branch for a
  -- chosen state, one for none, each with its own index.
  with q as (select lower(btrim(coalesce(p_query, ''))) as s),
  hit as (
    (select r.id
       from public.services_regions r
      where p_state is null
        and (select length(s) from q) >= 2
        and lower(r.place) ~>=~ (select s from q)
        and lower(r.place) ~<~ (select left(s, length(s) - 1) || chr(ascii(right(s, 1)) + 1) from q)
      limit 500)
    union all
    (select r.id
       from public.services_regions r
      where p_state is not null
        and r.state = p_state
        and (select length(s) from q) >= 2
        and lower(r.place) ~>=~ (select s from q)
        and lower(r.place) ~<~ (select left(s, length(s) - 1) || chr(ascii(right(s, 1)) + 1) from q)
      limit 500))
  select r.place, r.district,
         coalesce(to_jsonb(r) ->> 'block', null) as block,
         coalesce(to_jsonb(r) ->> 'kind', '') as kind,
         coalesce(to_jsonb(r) ->> 'source', '') as source,
         r.lat, r.lng
    from public.services_regions r
    join hit h on h.id = r.id, q
   order by (lower(r.place) = q.s) desc,
            (coalesce(to_jsonb(r) ->> 'source', '') = 'post'),
            (r.lat is null),
            length(r.place), r.place
   limit greatest(1, least(coalesce(p_limit, 25), 50));
$fn$;

grant execute on function public.services_search_places(text, text, int) to anon, authenticated;

notify pgrst, 'reload schema';

select jsonb_pretty(jsonb_build_object(
  'tilthai_tripura', (select jsonb_agg(x) from public.services_search_places('Tripura', 'tilthai', 5) x),
  'tilthai_any_state', (select count(*) from public.services_search_places(null, 'tilthai', 5)),
  'expected', 'Tilthai with a position, from both calls, answered at once'
)) as "95_verify";
