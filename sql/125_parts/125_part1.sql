-- ===========================================================================
-- 125_part1.sql -- the real address of a listing, for its card. Taken from the
-- listing when it has one, otherwise from the owner's account address. Only
-- for approved listings, only the address text and nothing else.
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
         coalesce(nullif(btrim(w.address_line), ''), nullif(btrim(s.address), ''))::text
    from public.services_workers w
    left join public.services_signups s on s.id = w.user_id or s.auth_user_id = w.user_id
   where w.id = any (p_ids) and w.status = 'approved'
     and coalesce(w.address_public, true);
$fn$;
revoke all on function public.services_work_addresses(uuid[]) from public;
grant execute on function public.services_work_addresses(uuid[]) to anon, authenticated;
notify pgrst, 'reload schema';
select 'part 1 of 1 done' as "125_part1";
