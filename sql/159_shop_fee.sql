-- ===========================================================================
-- 159_shop_fee.sql -- run after 158_rate_card_gst.sql.
-- A fee Dhundo charges the SHOP per order: a flat amount plus a percent of
-- the order value, set per kind of order on the rate card.
-- ===========================================================================
alter table public.services_rate_card
  add column if not exists shop_flat_rupees int not null default 0
    check (shop_flat_rupees between 0 and 1000),
  add column if not exists shop_percent numeric(4,1) not null default 0
    check (shop_percent between 0 and 30);

drop function if exists public.services_rate_card();
create function public.services_rate_card()
returns table (key text, label text, base_rupees int, per_km_rupees int,
               min_rupees int, platform_rupees int, gst_percent int,
               shop_flat_rupees int, shop_percent numeric)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select c.key, c.label, c.base_rupees, c.per_km_rupees, c.min_rupees,
         c.platform_rupees, c.gst_percent, c.shop_flat_rupees, c.shop_percent
    from public.services_rate_card c order by c.sort, c.key;
$fn$;
revoke all on function public.services_rate_card() from public;
grant execute on function public.services_rate_card() to anon, authenticated;

create or replace function public.services_rate_set_shop(
  p_key text, p_flat int, p_percent numeric)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  update public.services_rate_card c
     set shop_flat_rupees = least(greatest(coalesce(p_flat, 0), 0), 1000),
         shop_percent = least(greatest(coalesce(p_percent, 0), 0), 30),
         updated_at = now()
   where c.key = p_key;
  if not found then
    return query select false, 'no_such_service'::text;
    return;
  end if;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_rate_set_shop(text, int, numeric) from public, anon;
grant execute on function public.services_rate_set_shop(text, int, numeric) to authenticated;
notify pgrst, 'reload schema';
select '159 shop fee done' as "159";
