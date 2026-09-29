-- ===========================================================================
-- 77_functions_all_states.sql
--
-- FIXES: every place from a new state being silently dropped by the import
-- (Andhra Pradesh: 27,998 sent, 0 stored), and listings in new states being
-- refused.
--
-- 75 opened the TABLE rules to all 36 states, but four functions carry the
-- old list inside their own bodies:
--
--   services_load_regions   ... and (x->>'state') in ('Tripura','Delhi','Haryana')
--   services_add_region
--   services_admin_upsert
--   services_self_register
--
-- Their source is not in this repository, so rather than retype them (and
-- risk changing anything else), this takes each one's CURRENT definition
-- from the database, swaps only the three-name list for
-- services_state_list(), and re-creates it. Everything else in each body is
-- untouched. The forms handled:
--
--   x in ('Tripura','Delhi','Haryana')        -> x = any(services_state_list())
--   x not in ('Tripura','Delhi','Haryana')    -> x <> all(services_state_list())
--   array['Tripura','Delhi','Haryana']        -> services_state_list()
--
-- in any order of the three names and any spacing. A function whose body
-- still names them afterwards is reported by VERIFY rather than guessed at.
-- ===========================================================================

do $$
begin
  if to_regproc('public.services_state_list') is null then
    raise exception 'Run 75 first.';
  end if;
end $$;

drop table if exists _77_done;
create temporary table _77_done (fn text, changed boolean);

do $$
declare
  f      record;
  old    text;
  new    text;
  -- One of the three names, quoted, optionally cast.
  nm     constant text := $re$'(?:Tripura|Delhi|Haryana)'(?:::text)?$re$;
  three  text;
begin
  three := nm || '\s*,\s*' || nm || '\s*,\s*' || nm;

  for f in
    select p.oid, p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prosrc ilike '%Tripura%' and p.prosrc ilike '%Haryana%'
       and p.proname <> 'services_state_list'
  loop
    old := pg_get_functiondef(f.oid);
    new := regexp_replace(old, '\mnot\s+in\s*\(\s*' || three || '\s*\)',
                          '<> all(public.services_state_list())', 'gi');
    new := regexp_replace(new, '\min\s*\(\s*' || three || '\s*\)',
                          '= any(public.services_state_list())', 'gi');
    new := regexp_replace(new, '\marray\s*\[\s*' || three || '\s*\](?:::text\[\])?',
                          'public.services_state_list()', 'gi');

    if new <> old then
      execute new;
    end if;
    insert into _77_done values (f.proname, new <> old);
  end loop;
end $$;

-- ===========================================================================
-- VERIFY
--
-- rewritten: each function and whether it changed. still_naming_old_states
-- must be [] -- if a name is left there, that function checks the states in
-- some other way; send its source over:
--   select prosrc from pg_proc where proname = '<name>';
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'rewritten', (select coalesce(jsonb_object_agg(fn, changed), '{}'::jsonb) from _77_done),
  'still_naming_old_states', (select coalesce(jsonb_agg(proname), '[]'::jsonb)
                                from pg_proc
                               where pronamespace = 'public'::regnamespace
                                 and prosrc ilike '%Tripura%' and prosrc ilike '%Haryana%'
                                 and proname <> 'services_state_list'),
  'loader_now_accepts', (select prosrc ilike '%services_state_list()%' from pg_proc
                          where proname = 'services_load_regions' limit 1),
  'expected', 'every rewritten value true; still_naming_old_states []; loader_now_accepts true'
)) as "77_verify";
