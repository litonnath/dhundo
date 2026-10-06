-- 139: fuel prices for the standard ride rate, the fuel each driver uses, and
-- the pricing facts a passenger needs. To change a price later, run for example:
--   update public.services_fuel_prices set price = 103, updated_at = now() where fuel = 'petrol';
create table if not exists public.services_fuel_prices (
  fuel       text primary key check (fuel in ('petrol', 'diesel', 'cng', 'electric')),
  price      numeric not null check (price > 0),
  updated_at timestamptz not null default now()
);
insert into public.services_fuel_prices (fuel, price) values
  ('petrol', 100), ('diesel', 90), ('cng', 80), ('electric', 9)
  on conflict (fuel) do nothing;
alter table public.services_fuel_prices enable row level security;
revoke all on public.services_fuel_prices from public, anon, authenticated;

create or replace function public.services_fuel_prices()
returns table (fuel text, price numeric)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select f.fuel, f.price from public.services_fuel_prices f;
$fn$;
revoke all on function public.services_fuel_prices() from public;
grant execute on function public.services_fuel_prices() to anon, authenticated;

alter table public.services_workers add column if not exists fuel_type text
  check (fuel_type is null or fuel_type in ('petrol', 'diesel', 'cng', 'electric'));

create or replace function public.services_my_fuel()
returns table (fuel_type text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.fuel_type::text from public.services_workers w
   where w.user_id = public.services_account_id() and w.status in ('approved', 'pending')
   limit 1;
$fn$;
revoke all on function public.services_my_fuel() from public, anon, authenticated;
grant execute on function public.services_my_fuel() to authenticated;

create or replace function public.services_set_fuel(p_fuel text)
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_n int;
begin
  update public.services_workers
     set fuel_type = case when p_fuel in ('petrol', 'diesel', 'cng', 'electric') then p_fuel end
   where user_id = public.services_account_id() and status in ('approved', 'pending');
  get diagnostics v_n = row_count;
  return query select v_n > 0;
end;
$fn$;
revoke all on function public.services_set_fuel(text) from public, anon, authenticated;
grant execute on function public.services_set_fuel(text) to authenticated;

create or replace function public.services_driver_pricing(p_ids uuid[])
returns table (id uuid, per_km_rupees int, fuel_type text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.id, w.per_km_rupees, w.fuel_type::text
    from public.services_workers w
   where w.id = any (coalesce(p_ids, '{}'::uuid[])) and w.status = 'approved'
   limit 60;
$fn$;
revoke all on function public.services_driver_pricing(uuid[]) from public;
grant execute on function public.services_driver_pricing(uuid[]) to anon, authenticated;
notify pgrst, 'reload schema';
select 'done' as "139";
