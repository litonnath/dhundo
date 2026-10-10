-- ===========================================================================
-- 183_ride_rates_1.sql -- fares for bike taxis, autos and cabs / taxis come from
-- the rate card, by distance, like other ride apps: max(minimum, base + per km
-- x km). The old single "ride" row becomes the bike row, with an auto row and a
-- cab / taxi row beside it. Each ride row also has band_pct: how many percent
-- up or down a driver may move the per-km rate (drivers set a range inside it).
-- Run after 160/161 (the rate card). Then 183_ride_rates_2.sql.
-- ===========================================================================
alter table public.services_rate_card
  add column if not exists band_pct int not null default 20 check (band_pct between 0 and 100);

update public.services_rate_card set key = 'ride_bike', label = 'Bike taxi', sort = 1
 where key = 'ride' and not exists (select 1 from public.services_rate_card where key = 'ride_bike');
insert into public.services_rate_card (key, label, base_rupees, per_km_rupees, min_rupees, platform_rupees, sort) values
  ('ride_bike', 'Bike taxi', 20, 8, 30, 2, 1),
  ('ride_auto', 'Auto rickshaw', 30, 12, 40, 2, 11),
  ('ride_taxi', 'Cab / taxi', 50, 16, 80, 2, 12)
on conflict (key) do nothing;

drop function if exists public.services_rate_card();
create function public.services_rate_card()
returns table (key text, label text, base_rupees int, per_km_rupees int,
               min_rupees int, platform_rupees int, gst_percent int, band_pct int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select c.key, c.label, c.base_rupees, c.per_km_rupees, c.min_rupees,
         c.platform_rupees, c.gst_percent, c.band_pct
    from public.services_rate_card c order by c.sort, c.key;
$fn$;
revoke all on function public.services_rate_card() from public;
grant execute on function public.services_rate_card() to anon, authenticated;

create or replace function public.services_rate_set_band(p_key text, p_pct int)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  update public.services_rate_card set band_pct = least(greatest(coalesce(p_pct, 20), 0), 100), updated_at = now()
   where key = p_key;
  if not found then
    return query select false, 'no_such_service'::text;
    return;
  end if;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_rate_set_band(text, int) from public, anon;
grant execute on function public.services_rate_set_band(text, int) to authenticated;
notify pgrst, 'reload schema';
select '183 part 1 done' as "183_1";
