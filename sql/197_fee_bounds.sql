-- ===========================================================================
-- 197_fee_bounds.sql -- admin sets the delivery partner fee MINIMUM and
-- MAXIMUM. Minimum = the rate card's "minimum"; maximum = new max_rupees.
-- Run this BEFORE re-running 182_delivery_quote.sql.
-- ===========================================================================
alter table public.services_rate_card add column if not exists band_pct int not null default 20;
alter table public.services_rate_card add column if not exists max_rupees int not null default 100;

drop function if exists public.services_rate_card();
create function public.services_rate_card()
returns table (key text, label text, base_rupees int, per_km_rupees int,
               min_rupees int, platform_rupees int, gst_percent int, band_pct int, max_rupees int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select c.key, c.label, c.base_rupees, c.per_km_rupees, c.min_rupees,
         c.platform_rupees, c.gst_percent, c.band_pct, c.max_rupees
    from public.services_rate_card c order by c.sort, c.key;
$fn$;
revoke all on function public.services_rate_card() from public;
grant execute on function public.services_rate_card() to anon, authenticated;

create or replace function public.services_rate_set_max(p_key text, p_max int)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  update public.services_rate_card
     set max_rupees = greatest(coalesce(p_max, 100), min_rupees), updated_at = now()
   where key = p_key;
  if not found then
    return query select false, 'no_such_service'::text;
    return;
  end if;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_rate_set_max(text, int) from public, anon;
grant execute on function public.services_rate_set_max(text, int) to authenticated;

-- the highest delivery partner fee for this shop's delivery type, in paise
create or replace function public.services_fee_cap(p_worker uuid)
returns int
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select coalesce((
    select greatest(c.max_rupees, c.min_rupees) * 100
      from public.services_rate_card c
      join public.services_workers s on s.id = p_worker
      left join public.services_trades t on t.slug = s.trade_slug
     where c.key = case when t.group_name = 'Eat & Stay' then 'delivery_food' else 'delivery_small' end), 10000);
$fn$;
revoke all on function public.services_fee_cap(uuid) from public, anon, authenticated;
notify pgrst, 'reload schema';
select '197 fee bounds done' as "197";
