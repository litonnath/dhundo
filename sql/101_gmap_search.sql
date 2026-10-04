-- ===========================================================================
-- 101_gmap_search.sql   (run after 100)
-- Adds a monthly allowance for Google place search (the search box on the
-- map, used when Enter is pressed). Change:
--   update services_gmap_caps set cap = 3000 where kind = 'search';
-- ===========================================================================
insert into public.services_gmap_caps (kind, cap) values ('search', 2000) on conflict do nothing;

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
  if p_kind <> 'tiles' and not exists (select 1 from public.services_gmap_caps where kind = p_kind) then
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
