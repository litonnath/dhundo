-- 134: a driver is shown with the address and position from their account
-- (services_signups), not the listing. Drivers group only.
create or replace function public.services_driver_homes(p_ids uuid[])
returns table (id uuid, address text, lat double precision, lng double precision)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.id, nullif(g.address, '')::text, g.home_lat, g.home_lng
    from public.services_workers w
    join public.services_trades t on t.slug = w.trade_slug and t.group_name = 'Drivers'
    join public.services_signups g on g.id = w.user_id
   where w.id = any (coalesce(p_ids, '{}'::uuid[])) and w.status = 'approved'
   limit 25;
$fn$;
revoke all on function public.services_driver_homes(uuid[]) from public;
grant execute on function public.services_driver_homes(uuid[]) to anon, authenticated;
notify pgrst, 'reload schema';
select 'done' as "134";
