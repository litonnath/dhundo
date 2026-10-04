-- ===========================================================================
-- 117_part5.sql -- saving a menu item now takes a photo address.
-- ===========================================================================
drop function if exists public.services_menu_save(uuid, text, text, text, int, boolean, boolean);
create function public.services_menu_save(
  p_id uuid, p_category text, p_name text, p_about text,
  p_price_rupees int, p_veg boolean, p_available boolean, p_photo text default null)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_work uuid;
  v_photo text := case when p_photo like 'https://%' and length(p_photo) <= 500 then p_photo end;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('menu_save', v_me::text, 200, 86400);
  select w.id into v_work from public.services_workers w
   where w.user_id = v_me and w.status = 'approved' limit 1;
  if v_work is null then
    return query select false, 'no_listing'::text;
    return;
  end if;
  if length(btrim(coalesce(p_name, ''))) < 2 or coalesce(p_price_rupees, 0) < 1 then
    return query select false, 'bad_input'::text;
    return;
  end if;
  if p_id is null then
    insert into public.services_menu_items (worker_id, category, name, about, price_paise, veg, available, photo_url)
    values (v_work, coalesce(nullif(left(btrim(p_category), 40), ''), 'Menu'), left(btrim(p_name), 80),
            nullif(left(btrim(coalesce(p_about, '')), 200), ''),
            least(p_price_rupees, 20000) * 100, coalesce(p_veg, true), coalesce(p_available, true), v_photo);
  else
    update public.services_menu_items m
       set category = coalesce(nullif(left(btrim(p_category), 40), ''), 'Menu'),
           name = left(btrim(p_name), 80),
           about = nullif(left(btrim(coalesce(p_about, '')), 200), ''),
           price_paise = least(p_price_rupees, 20000) * 100,
           veg = coalesce(p_veg, true), available = coalesce(p_available, true), photo_url = v_photo
     where m.id = p_id and m.worker_id = v_work;
  end if;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_menu_save(uuid, text, text, text, int, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.services_menu_save(uuid, text, text, text, int, boolean, boolean, text) to authenticated;

select 'part 5 of 9 done' as "117_part5";
