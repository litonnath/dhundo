-- ===========================================================================
-- 110_part1.sql -- settings table, and contact reveal that can require a
-- checked phone (sql/109) and a lower hourly limit.
-- The requirement is OFF until you switch it on, so nothing breaks before
-- the SMS provider works. Switch on with:
--   update services_settings set value = on where name = reveal_needs_phone;
-- ===========================================================================
create table if not exists public.services_settings (
  name  text primary key,
  value text not null
);
alter table public.services_settings enable row level security;
revoke all on public.services_settings from public, anon, authenticated;
insert into public.services_settings (name, value) values ('reveal_needs_phone', 'off')
  on conflict do nothing;

create or replace function public.services_setting(p_name text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select value from public.services_settings where name = p_name;
$fn$;
revoke all on function public.services_setting(text) from public, anon, authenticated;

select 'part 1 of 4 done' as "110_part1";
