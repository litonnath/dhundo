-- ===========================================================================
-- 125_part1.sql -- the address typed on a listing, for its card. Only the
-- listing own address: the account address is the nearest landmark noted when
-- the person picked their location, not where they work, so it is not used.
-- ===========================================================================
drop function if exists public.services_work_addresses(uuid[]);
create function public.services_work_addresses(p_ids uuid[])
returns table (id uuid, address text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.id,
         nullif(btrim(w.address_line), '')::text
    from public.services_workers w
   where w.id = any (p_ids) and w.status = 'approved'
     and coalesce(w.address_public, true);
$fn$;
revoke all on function public.services_work_addresses(uuid[]) from public;
grant execute on function public.services_work_addresses(uuid[]) to anon, authenticated;
notify pgrst, 'reload schema';
select 'part 1 of 1 done' as "125_part1";
