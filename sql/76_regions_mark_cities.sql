-- ===========================================================================
-- 76_regions_mark_cities.sql
--
-- FIXES: the "Choose your town" list being empty in every state added by 75.
--
-- 69 decided which places are towns (is_city) with a ONE-TIME update over
-- the rows that existed then. Anything loaded afterwards -- every place the
-- all-India import brings in -- arrives with is_city = false and never
-- becomes pickable. That was harmless while the three original states had
-- already been imported; it is not now.
--
-- From here on a trigger does the same seeding as each row arrives, under
-- the same rule and the same guard: city_seeded marks a row whose is_city
-- has been decided, so a place promoted or demoted by hand is never undone
-- by a later import.
-- ===========================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'services_regions'
                    and column_name = 'city_seeded') then
    raise exception 'Run 69 first.';
  end if;
end $$;

create or replace function public.services_regions_seed_city()
returns trigger
language plpgsql
as $$
begin
  if not coalesce(new.city_seeded, false) then
    new.is_city     := coalesce(new.kind, '') in ('city', 'town');
    new.city_seeded := true;
  end if;
  return new;
end;
$$;

drop trigger if exists services_regions_seed_city on public.services_regions;
create trigger services_regions_seed_city
  before insert on public.services_regions
  for each row execute function public.services_regions_seed_city();

-- Anything loaded between 69 and now.
update public.services_regions
   set is_city = (kind in ('city', 'town')),
       city_seeded = true
 where city_seeded = false;

-- ===========================================================================
-- VERIFY
-- towns_by_state is the list the town picker draws from. A state showing 0
-- here has not been imported yet: run import_all_india.sh.
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'trigger', (select count(*) from pg_trigger
               where tgrelid = 'public.services_regions'::regclass
                 and tgname = 'services_regions_seed_city'),
  'unseeded_left', (select count(*) from public.services_regions where not city_seeded),
  'towns_by_state', (select coalesce(jsonb_object_agg(state, n), '{}'::jsonb)
                       from (select state, count(*) n from public.services_regions
                              where is_city and active group by state) s),
  'places_by_state', (select coalesce(jsonb_object_agg(state, n), '{}'::jsonb)
                        from (select state, count(*) n from public.services_regions
                               where active group by state) s),
  'expected', 'trigger 1; unseeded_left 0'
)) as "76_verify";
