-- 85 part 2 of 2: place every worker again with the new order from part 1.

-- Place everyone again, GPS positions left as they are. Only this trigger
-- runs for the update, so nothing else (approval, timestamps) is touched;
-- one block, so on any error it all rolls back with triggers as before.
drop table if exists _85_before;
create temporary table _85_before as
  select loc_source, count(*) n from public.services_workers group by 1;
drop table if exists _85_status;
create temporary table _85_status as
  select status::text || '/' || coalesce(verified::text, '-') k, count(*) n
    from public.services_workers group by 1;

do $b$
begin
  alter table public.services_workers disable trigger user;
  alter table public.services_workers enable trigger services_workers_fill_coords;
  update public.services_workers set locality = locality
   where loc_source is distinct from 'device' and loc_source is distinct from 'picked';
  alter table public.services_workers enable trigger user;
end $b$;

notify pgrst, 'reload schema';

select jsonb_pretty(jsonb_build_object(
  'before', (select jsonb_object_agg(coalesce(loc_source, 'none'), n) from _85_before),
  'after',  (select jsonb_object_agg(coalesce(loc_source, 'none'), n)
               from (select loc_source, count(*) n from public.services_workers group by 1) a),
  'status_unchanged', (select count(*) = 0 from (
      (select k, n from _85_status) except
      (select status::text || '/' || coalesce(verified::text, '-'), count(*)
         from public.services_workers group by 1)) d),
  'expected', 'more under area, fewer under pin and city; status_unchanged true'
)) as "85_verify";
