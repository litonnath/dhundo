-- 162: only the customer pays Dhundo anything: one small "miscellaneous fee"
-- (the platform_rupees column) plus 18% GST on it. Nothing is charged to
-- shops, restaurants or riders, so the shop-fee columns go.
drop function if exists public.services_rate_set_shop(text, int, numeric);
drop function if exists public.services_rate_card();
alter table public.services_rate_card drop column if exists shop_flat_rupees;
alter table public.services_rate_card drop column if exists shop_percent;
create function public.services_rate_card()
returns table (key text, label text, base_rupees int, per_km_rupees int,
               min_rupees int, platform_rupees int, gst_percent int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select c.key, c.label, c.base_rupees, c.per_km_rupees, c.min_rupees,
         c.platform_rupees, c.gst_percent
    from public.services_rate_card c order by c.sort, c.key;
$fn$;
revoke all on function public.services_rate_card() from public;
grant execute on function public.services_rate_card() to anon, authenticated;
notify pgrst, 'reload schema';
select '162 customer-only misc fee done' as "162";
