-- ===========================================================================
-- 78_default_city_by_state.sql
--
-- FIXES: a listing in any new state being filed under "Agartala".
--
-- services_admin_upsert and services_self_register fill in a city when none
-- was chosen:
--
--   case v_state when 'Delhi' then 'Delhi' when 'Haryana' then 'Gurugram'
--                else 'Agartala' end
--
-- With three states, "else" meant Tripura. With thirty-six it means a
-- plumber in Kerala is listed in Agartala. Tripura keeps Agartala; every
-- other state gets no default city (or, if services_workers.city does not
-- allow empty, the state's own name -- vague but never wrong). The 69
-- trigger still replaces it with the real town whenever one is picked.
--
-- As in 77, each function is re-created from its current definition with
-- only this expression changed. The default state of 'Tripura' for a call
-- that sends none is left alone: that matches DEFAULT_STATE in the app.
-- ===========================================================================

drop table if exists _78_done;
create temporary table _78_done (fn text, changed boolean);

do $$
declare
  f         record;
  old       text;
  new       text;
  fallback  text;
begin
  select case when is_nullable = 'YES' then 'null' else 'v_state' end
    into fallback
    from information_schema.columns
   where table_schema = 'public' and table_name = 'services_workers'
     and column_name = 'city';
  fallback := coalesce(fallback, 'null');

  for f in
    select p.oid, p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('services_admin_upsert', 'services_self_register')
  loop
    old := pg_get_functiondef(f.oid);
    new := regexp_replace(old,
             $re$else\s+'Agartala'\s+end$re$,
             $r$when 'Tripura' then 'Agartala' else $r$ || fallback || ' end',
             'gi');
    if new <> old then
      execute new;
    end if;
    insert into _78_done values (f.proname, new <> old);
  end loop;
end $$;

select jsonb_pretty(jsonb_build_object(
  'rewritten', (select coalesce(jsonb_object_agg(fn, changed), '{}'::jsonb) from _78_done),
  'still_defaulting_to_agartala', (select coalesce(jsonb_agg(proname), '[]'::jsonb)
                                     from pg_proc
                                    where pronamespace = 'public'::regnamespace
                                      and prosrc ~* $re$else\s+'Agartala'$re$),
  'expected', 'both rewritten true; still_defaulting_to_agartala []'
)) as "78_verify";

-- Listings already filed in Agartala outside Tripura, if any were created
-- before this ran. Check, and correct by hand if the list is not empty:
--   select id, state, city from public.services_workers
--    where city = 'Agartala' and state <> 'Tripura';
