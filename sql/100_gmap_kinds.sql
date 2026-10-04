-- ===========================================================================
-- 100_gmap_kinds.sql   (run after 99)
--
-- Separate monthly allowances for each kind of Google call, all counted here:
--   tiles    map sessions            (cap in services_gmap_cap, from 99)
--   geocode  address of a saved pin
--   nearby   shops and landmarks beside a saved pin
-- When one is used up the app falls back to the free OpenStreetMap lookup.
-- Change one:  update services_gmap_caps set cap = 3000 where kind = 'nearby';
-- ===========================================================================
create table if not exists public.services_gmap_caps (
  kind text primary key,
  cap  int not null
);
insert into public.services_gmap_caps (kind, cap) values ('geocode', 6000), ('nearby', 2000)
  on conflict do nothing;
alter table public.services_gmap_caps enable row level security;
revoke all on public.services_gmap_caps from public, anon, authenticated;

drop function if exists public.services_gmap_take();
create or replace function public.services_gmap_take(p_kind text default 'tiles')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM');
  v_key   text;
  v_cap   int;
  v_used  int;
begin
  if p_kind not in ('tiles', 'geocode', 'nearby') then
    return jsonb_build_object('ok', false);
  end if;
  v_key := case when p_kind = 'tiles' then v_month else p_kind || '-' || v_month end;
  if p_kind = 'tiles' then
    select cap into v_cap from public.services_gmap_cap where id;
  else
    select cap into v_cap from public.services_gmap_caps where kind = p_kind;
  end if;
  insert into public.services_gmap_usage (month, loads) values (v_key, 0)
    on conflict (month) do nothing;
  update public.services_gmap_usage
     set loads = loads + 1
   where month = v_key and loads < coalesce(v_cap, 0)
   returning loads into v_used;
  if v_used is null then
    select loads into v_used from public.services_gmap_usage where month = v_key;
    return jsonb_build_object('ok', false, 'used', v_used, 'cap', v_cap);
  end if;
  return jsonb_build_object('ok', true, 'used', v_used, 'cap', v_cap);
end;
$$;

revoke all on function public.services_gmap_take(text) from public;
grant execute on function public.services_gmap_take(text) to anon, authenticated;

notify pgrst, 'reload schema';
