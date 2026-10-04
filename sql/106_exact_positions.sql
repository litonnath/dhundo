-- ===========================================================================
-- 106_exact_positions.sql -- which listings have an exact position.
-- A position placed on the map or read from the phone is exact; one that is
-- only the middle of a PIN code, village or city is not, and every distance
-- to it is approximate. The search screen uses this to say so. It returns
-- ids only, never positions.
-- ===========================================================================
create or replace function public.services_exact_positions(p_ids uuid[])
returns table (id uuid)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.id
    from public.services_workers w
   where w.id = any (coalesce(p_ids, '{}'::uuid[]))
     and w.status = 'approved'
     and w.loc_source in ('device', 'picked')
   limit 200;
$fn$;

revoke all on function public.services_exact_positions(uuid[]) from public;
grant execute on function public.services_exact_positions(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
select 'done' as "106_exact_positions";
