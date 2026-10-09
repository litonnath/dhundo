-- ===========================================================================
-- 158_rate_card_gst.sql -- run after 157_rate_card.sql.
-- Changes the meaning of the card: the fare is what the rider/driver earns
-- (nothing is taken from it). The customer pays that PLUS Dhundo's flat
-- platform fee PLUS GST on the platform fee. Dhundo keeps the platform fee;
-- the GST is collected for the government.
-- ===========================================================================
alter table public.services_rate_card
  add column if not exists gst_percent int not null default 18
  check (gst_percent between 0 and 40);

drop function if exists public.services_rate_card();
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

drop function if exists public.services_rate_set(text, int, int, int, int);
create function public.services_rate_set(
  p_key text, p_base int, p_per_km int, p_min int, p_platform int, p_gst int)
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
     set base_rupees = least(greatest(coalesce(p_base, 0), 0), 5000),
         per_km_rupees = least(greatest(coalesce(p_per_km, 0), 0), 500),
         min_rupees = least(greatest(coalesce(p_min, 0), 0), 5000),
         platform_rupees = least(greatest(coalesce(p_platform, 0), 0), 1000),
         gst_percent = least(greatest(coalesce(p_gst, 0), 0), 40),
         updated_at = now()
   where c.key = p_key;
  if not found then
    return query select false, 'no_such_service'::text;
    return;
  end if;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_rate_set(text, int, int, int, int, int) from public, anon;
grant execute on function public.services_rate_set(text, int, int, int, int, int) to authenticated;
notify pgrst, 'reload schema';
select '158 rate card gst done' as "158";
