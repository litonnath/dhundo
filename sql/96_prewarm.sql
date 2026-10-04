-- ===========================================================================
-- 96_prewarm.sql   (optional)
--
-- The first place search after the indexes are built, or after the database
-- restarts, has to read them from disk and can run into the statement
-- timeout; every search after it is instant. This reads the search indexes
-- into memory once, so that first search is not the slow one.
--
-- It lasts until the database restarts or the memory is needed for something
-- else. The app also warms the index itself when the location sheet opens, so
-- this is a belt to go with that braces. If your project does not allow the
-- pg_prewarm extension, skip this file.
-- ===========================================================================
set statement_timeout = 0;
create extension if not exists pg_prewarm;

select jsonb_pretty(jsonb_build_object(
  'regions_by_state_blocks', pg_prewarm('public.services_regions_prefix_state'),
  'regions_all_blocks',      pg_prewarm('public.services_regions_prefix_all'),
  'tilthai_ms', (select round(extract(epoch from (clock_timestamp() - now())) * 1000)::int),
  'tilthai_found', (select count(*) from public.services_search_places('Tripura', 'tilthai', 5)),
  'expected', 'block counts above zero, tilthai_found 2'
)) as "96_verify";
