-- ===========================================================================
-- 75_all_states.sql
--
-- Opens the directory to every state and union territory of India.
--
-- 57 limited services_workers.state to Tripura, Delhi and Haryana with a
-- CHECK constraint, on purpose: where the product operates was meant to be a
-- decision, not a display tweak. This is that decision. The list below must
-- match STATES in src/states.js exactly -- the app sends these spellings.
--
-- 57 is not in this repository, so the constraint is found by what it says
-- rather than by its name: any single-column CHECK in the public schema that
-- mentions 'Tripura' is replaced with one that accepts every state. Anything
-- else it mentioned is ignored, which is why the VERIFY block at the bottom
-- lists what it replaced -- look at that list before trusting it.
-- ===========================================================================

create or replace function public.services_state_list()
returns text[]
language sql
immutable
as $$
  select array[
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
    'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
    'Ladakh', 'Lakshadweep', 'Puducherry'
  ]::text[];
$$;

create or replace function public.services_is_state(p_state text)
returns boolean
language sql
immutable
as $$
  select p_state = any(public.services_state_list());
$$;

grant execute on function public.services_state_list() to anon, authenticated;
grant execute on function public.services_is_state(text) to anon, authenticated;

-- What was replaced, kept for the VERIFY output.
drop table if exists _75_replaced;
create temporary table _75_replaced (tbl text, col text, old_def text);

do $$
declare
  c   record;
  col text;
begin
  for c in
    select con.oid, con.conname, con.conrelid::regclass as tbl, con.conkey,
           pg_get_constraintdef(con.oid) as def
      from pg_constraint con
      join pg_namespace n on n.oid = con.connamespace
     where n.nspname = 'public'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%Tripura%'
  loop
    if array_length(c.conkey, 1) <> 1 then
      raise notice 'Skipping % on %: it checks more than one column. Fix by hand: %',
        c.conname, c.tbl, c.def;
      continue;
    end if;

    select a.attname into col
      from pg_attribute a
     where a.attrelid = c.tbl and a.attnum = c.conkey[1];

    insert into _75_replaced values (c.tbl::text, col, c.def);

    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
    -- NOT VALID, then VALIDATE: every existing row already holds one of the
    -- three old names, all of which are in the new list, so validation
    -- cannot fail -- but it runs without holding a write lock the whole time.
    execute format(
      'alter table %s add constraint %I check (%I is null or public.services_is_state(%I)) not valid',
      c.tbl, c.conname, col, col);
    execute format('alter table %s validate constraint %I', c.tbl, c.conname);
  end loop;
end $$;

-- ===========================================================================
-- VERIFY
--
-- functions_naming_old_states: any function whose body still names the old
-- three together is probably validating the state itself (e.g. raising
-- 'bad_state'). If this is not empty, send those function names over -- each
-- needs the same change as the constraint, and they are not in this repo.
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'states_known', array_length(public.services_state_list(), 1),
  'constraints_replaced', (select coalesce(jsonb_agg(jsonb_build_object(
                             'table', tbl, 'column', col, 'was', old_def)), '[]'::jsonb)
                             from _75_replaced),
  'constraints_still_old', (select count(*) from pg_constraint con
                              join pg_namespace n on n.oid = con.connamespace
                             where n.nspname = 'public' and con.contype = 'c'
                               and pg_get_constraintdef(con.oid) ilike '%Tripura%'),
  'functions_naming_old_states', (select coalesce(jsonb_agg(p.proname), '[]'::jsonb)
                                    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                   where n.nspname = 'public'
                                     and p.prosrc ilike '%Tripura%'
                                     and p.prosrc ilike '%Haryana%'
                                     and p.proname not in ('services_state_list')),
  'expected', 'states_known 36; constraints_replaced lists the state column(s); constraints_still_old 0; functions_naming_old_states []'
)) as "75_verify";
