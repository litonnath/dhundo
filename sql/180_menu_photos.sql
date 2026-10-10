-- ===========================================================================
-- 180_menu_photos.sql -- a restaurant or shop can upload photos of its printed
-- menu or price list, so customers can check the prices themselves. Up to 8
-- photos per listing. Anyone can read them (they are public, like the other
-- listing photos); only the listing's owner can change them.
-- ===========================================================================
alter table public.services_workers add column if not exists menu_photos text[] not null default '{}';

create or replace function public.services_set_menu_photos(p_urls text[])
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_urls text[];
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  select coalesce(array_agg(u), '{}') into v_urls
    from (select btrim(x) as u from unnest(coalesce(p_urls, '{}')) x
           where btrim(x) ~ '^https://[^ ]+$' and length(btrim(x)) <= 480 limit 8) q;
  update public.services_workers set menu_photos = v_urls where user_id = v_me;
  if not found then
    return query select false, 'no_listing'::text;
    return;
  end if;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_set_menu_photos(text[]) from public, anon;
grant execute on function public.services_set_menu_photos(text[]) to authenticated;

create or replace function public.services_store_menu_photos(p_worker uuid)
returns table (url text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select u from public.services_workers w, unnest(w.menu_photos) u
   where w.id = p_worker and w.status = 'approved';
$fn$;
revoke all on function public.services_store_menu_photos(uuid) from public;
grant execute on function public.services_store_menu_photos(uuid) to anon, authenticated;

create or replace function public.services_my_menu_photos()
returns table (url text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select u from public.services_workers w, unnest(w.menu_photos) u
   where w.user_id = public.services_account_id();
$fn$;
revoke all on function public.services_my_menu_photos() from public, anon;
grant execute on function public.services_my_menu_photos() to authenticated;
notify pgrst, 'reload schema';
select '180 menu photos done' as "180";
