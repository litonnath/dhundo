-- ===========================================================================
-- 117_part4.sql -- menus carry a photo. The functions that return a menu
-- change shape, so the old ones are dropped and made again.
-- ===========================================================================
drop function if exists public.services_menu_get(uuid);
create function public.services_menu_get(p_worker uuid)
returns table (id uuid, category text, name text, about text, price_paise int,
               veg boolean, accepting boolean, photo_url text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select m.id, m.category, m.name, m.about, m.price_paise, m.veg, w.accepting_orders, m.photo_url
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
               veg boolean, available boolean, accepting boolean, photo_url text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select m.id, m.category, m.name, m.about, m.price_paise, m.veg, m.available,
         w.accepting_orders, m.photo_url
    from public.services_menu_items m
    join public.services_workers w on w.id = m.worker_id
   where w.user_id = public.services_account_id()
   order by m.category, m.name;
$fn$;
revoke all on function public.services_my_menu() from public, anon, authenticated;
grant execute on function public.services_my_menu() to authenticated;

select 'part 4 of 9 done' as "117_part4";
