-- ===========================================================================
-- 97_api_timeout.sql
--
-- Raises the time a request from the app may run before the database cancels
-- it (error 57014, statement timeout) to 10 seconds, for people who are not
-- signed in and for people who are. Supabase sets 3 and 8 seconds.
--
-- This is the slack for a COLD search: the first one after the indexes are
-- built or the database restarts reads them from disk and can take a few
-- seconds, then every search after it takes a few milliseconds. With the
-- indexes from 95 the limit should rarely be reached at all.
--
-- It applies to everything the app asks of the database, not only the place
-- search, so a slow query somewhere else is also allowed to run longer before
-- it is cancelled. To go back: set the values to 3s and 8s.
-- ===========================================================================
alter role anon set statement_timeout = '10s';
alter role authenticated set statement_timeout = '10s';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

select jsonb_pretty(jsonb_build_object(
  'settings', (select jsonb_object_agg(rolname, rolconfig)
                 from pg_roles where rolname in ('anon', 'authenticated')),
  'expected', 'statement_timeout=10s for both anon and authenticated'
)) as "97_verify";
