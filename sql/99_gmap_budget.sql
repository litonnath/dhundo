-- ===========================================================================
-- 99_gmap_budget.sql
--
-- A monthly allowance of Google map sessions, counted here so every phone
-- and laptop shares ONE count. When the month's allowance is used the app
-- stops asking Google and draws the free map instead.
--
-- To change the allowance: update services_gmap_cap set cap = 8000;
-- ===========================================================================
create table if not exists public.services_gmap_cap (
  id   boolean primary key default true check (id),
  cap  int not null default 8000
);
insert into public.services_gmap_cap (id, cap) values (true, 8000) on conflict do nothing;

create table if not exists public.services_gmap_usage (
  month text primary key,
  loads int not null default 0
);

alter table public.services_gmap_cap enable row level security;
alter table public.services_gmap_usage enable row level security;
revoke all on public.services_gmap_cap from public, anon, authenticated;
revoke all on public.services_gmap_usage from public, anon, authenticated;

-- One call = one Google map session. Returns whether this one may use Google.
create or replace function public.services_gmap_take()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM');
  v_cap   int;
  v_used  int;
begin
  select cap into v_cap from public.services_gmap_cap where id;
  insert into public.services_gmap_usage (month, loads) values (v_month, 0)
    on conflict (month) do nothing;
  update public.services_gmap_usage
     set loads = loads + 1
   where month = v_month and loads < coalesce(v_cap, 8000)
   returning loads into v_used;
  if v_used is null then
    select loads into v_used from public.services_gmap_usage where month = v_month;
    return jsonb_build_object('ok', false, 'used', v_used, 'cap', v_cap);
  end if;
  return jsonb_build_object('ok', true, 'used', v_used, 'cap', v_cap);
end;
$$;

revoke all on function public.services_gmap_take() from public;
grant execute on function public.services_gmap_take() to anon, authenticated;

notify pgrst, 'reload schema';
