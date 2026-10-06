-- 144 part 1: each product says whether a bike can carry it. Run 143 part 2
-- first (it adds the column). The menu functions change shape, so they are
-- dropped and made again.
alter table public.services_menu_items add column if not exists bike_ok boolean not null default true;

drop function if exists public.services_menu_get(uuid);
create function public.services_menu_get(p_worker uuid)
returns table (id uuid, category text, name text, about text, price_paise int,
               veg boolean, accepting boolean, photo_url text, bike_ok boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select m.id, m.category, m.name, m.about, m.price_paise, m.veg, w.accepting_orders, m.photo_url, m.bike_ok
    from public.services_menu_items m
    join public.services_workers w on w.id = m.worker_id
   where m.worker_id = p_worker and m.available and w.status = 'approved'
   order by m.category, m.name;
$fn$;
revoke all on function public.services_menu_get(uuid) from public;
grant execute on function public.services_menu_get(uuid) to anon, authenticated;

drop function if exists public.services_my_menu();
create function public.services_my_menu()
returns table (id uuid, category text, name text, about text, price_paise int,
               veg boolean, available boolean, accepting boolean, photo_url text, bike_ok boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select m.id, m.category, m.name, m.about, m.price_paise, m.veg, m.available,
         w.accepting_orders, m.photo_url, m.bike_ok
    from public.services_menu_items m
    join public.services_workers w on w.id = m.worker_id
   where w.user_id = public.services_account_id()
   order by m.category, m.name;
$fn$;
revoke all on function public.services_my_menu() from public, anon, authenticated;
grant execute on function public.services_my_menu() to authenticated;
notify pgrst, 'reload schema';
select 'part 1 of 2 done' as "144_part1";
