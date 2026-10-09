-- ===========================================================================
-- 157_rate_card.sql -- the platform's fare and payout rate card.
-- One row per kind of trip: a base fare, a rate per km, a minimum, and the
-- flat rupees Dhundo keeps per trip. The partner (rider / driver) is paid
-- fare minus that flat amount. Anyone can read the card (shops use it to
-- suggest a delivery fee); only an admin can change it.
-- ===========================================================================
create table if not exists public.services_rate_card (
  key            text primary key,
  label          text not null,
  base_rupees    int  not null default 0 check (base_rupees between 0 and 5000),
  per_km_rupees  int  not null default 0 check (per_km_rupees between 0 and 500),
  min_rupees     int  not null default 0 check (min_rupees between 0 and 5000),
  platform_rupees int not null default 0 check (platform_rupees between 0 and 1000),
  sort           int  not null default 0,
  updated_at     timestamptz not null default now()
);
alter table public.services_rate_card enable row level security;
revoke all on public.services_rate_card from public, anon, authenticated;

insert into public.services_rate_card (key, label, base_rupees, per_km_rupees, min_rupees, platform_rupees, sort) values
  ('ride',            'Bike taxi / passenger ride',        20, 8,  30, 2, 1),
  ('delivery_food',   'Restaurant food delivery',          20, 7,  30, 2, 2),
  ('delivery_small',  'Shop delivery: small items',        20, 7,  30, 2, 3),
  ('delivery_medium', 'Shop delivery: medium / bulky',     40, 10, 60, 3, 4),
  ('delivery_heavy',  'Goods delivery: heavy / large vehicle', 120, 18, 200, 5, 5)
on conflict (key) do nothing;

create or replace function public.services_rate_card()
returns table (key text, label text, base_rupees int, per_km_rupees int,
               min_rupees int, platform_rupees int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select c.key, c.label, c.base_rupees, c.per_km_rupees, c.min_rupees, c.platform_rupees
    from public.services_rate_card c order by c.sort, c.key;
$fn$;
revoke all on function public.services_rate_card() from public;
grant execute on function public.services_rate_card() to anon, authenticated;

create or replace function public.services_rate_set(
  p_key text, p_base int, p_per_km int, p_min int, p_platform int)
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
         updated_at = now()
   where c.key = p_key;
  if not found then
    return query select false, 'no_such_service'::text;
    return;
  end if;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_rate_set(text, int, int, int, int) from public, anon;
grant execute on function public.services_rate_set(text, int, int, int, int) to authenticated;
notify pgrst, 'reload schema';
select '157 rate card done' as "157";
