-- ===========================================================================
-- 79_loc_source_values.sql
--
-- FIXES: saving any listing that has a PIN code failing with
--
--   23514 new row for relation "services_workers" violates check constraint
--         "services_workers_loc_source_check"
--
-- 69 taught the coordinate trigger two new answers to "where did this
-- position come from": 'pin' (the PIN code's centre) and 'city' (the chosen
-- town's centre). The CHECK constraint on loc_source, from before 69, was
-- never widened to allow them. It stayed invisible while services_pincodes
-- was empty; loading the PIN codes made every listing with one fail to save.
--
-- The constraint is recreated to allow all four of 69's sources, plus any
-- value already present in the table (so nothing existing can fail it).
-- ===========================================================================

do $$
declare
  v_allowed text[];
  v_list    text;
begin
  select array_agg(distinct v order by v) into v_allowed
    from (
      select unnest(array['device', 'pin', 'city', 'area']) as v
      union
      select loc_source from public.services_workers where loc_source is not null
    ) s;

  select string_agg(quote_literal(v), ', ') into v_list from unnest(v_allowed) v;

  alter table public.services_workers
    drop constraint if exists services_workers_loc_source_check;
  execute format(
    'alter table public.services_workers add constraint services_workers_loc_source_check
       check (loc_source is null or loc_source in (%s))', v_list);
end $$;

select jsonb_pretty(jsonb_build_object(
  'constraint_now', (select pg_get_constraintdef(oid) from pg_constraint
                      where conname = 'services_workers_loc_source_check'),
  'expected', 'allows device, pin, city and area. Then re-run the two updates:
    update public.services_workers set pincode = pincode;
    update public.services_workers set locality = locality where lat is null;'
)) as "79_verify";
