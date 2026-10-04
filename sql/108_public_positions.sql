-- ===========================================================================
-- 108_public_positions.sql -- positions the phone may use to ask Google for a
-- road distance. Needs 94 (loc_source values).
--
-- A listing that chose to show its address (address_public) and has an exact
-- position gives that exact position. Every other listing gives its position
-- rounded to about one kilometre, so a private home is never handed out; the
-- road distance to it is then approximate and the card says so.
-- Never returns anyone who is live (that position is private).
-- ===========================================================================
create or replace function public.services_public_positions(p_ids uuid[])
returns table (id uuid, lat double precision, lng double precision, exact boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.id,
         case when coalesce(w.address_public, false) and w.loc_source in ('device', 'picked')
              then w.lat else round(w.lat::numeric, 2)::double precision end,
         case when coalesce(w.address_public, false) and w.loc_source in ('device', 'picked')
              then w.lng else round(w.lng::numeric, 2)::double precision end,
         (coalesce(w.address_public, false) and w.loc_source in ('device', 'picked'))
    from public.services_workers w
   where w.id = any (coalesce(p_ids, '{}'::uuid[]))
     and w.status = 'approved'
     and w.lat is not null and w.lng is not null
   limit 25;
$fn$;

revoke all on function public.services_public_positions(uuid[]) from public;
grant execute on function public.services_public_positions(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
select 'done' as "108_public_positions";
