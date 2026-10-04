-- ===========================================================================
-- 110_part5.sql -- the Google allowance also has a daily cap (a twentieth of
-- the month), so a script cannot use the whole month in minutes; and the
-- admin withdrawal list shows the hold and flags a UPI id never paid before.
-- ===========================================================================
create or replace function public.services_gmap_take(p_kind text default 'tiles')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_ist   timestamp := now() at time zone 'Asia/Kolkata';
  v_month text := to_char(v_ist, 'YYYY-MM');
  v_key   text;
  v_dkey  text;
  v_cap   int;
  v_used  int;
begin
  if p_kind <> 'tiles' and not exists (select 1 from public.services_gmap_caps where kind = p_kind) then
    return jsonb_build_object('ok', false);
  end if;
  v_key := case when p_kind = 'tiles' then v_month else p_kind || '-' || v_month end;
  v_dkey := p_kind || '-d-' || to_char(v_ist, 'YYYY-MM-DD');
  if p_kind = 'tiles' then
    select cap into v_cap from public.services_gmap_cap where id;
  else
    select cap into v_cap from public.services_gmap_caps where kind = p_kind;
  end if;
  insert into public.services_gmap_usage (month, loads) values (v_key, 0), (v_dkey, 0) on conflict (month) do nothing;
  update public.services_gmap_usage set loads = loads + 1
   where month = v_dkey and loads < greatest(20, ceil(coalesce(v_cap, 0) / 20.0));
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'daily');
  end if;
  update public.services_gmap_usage set loads = loads + 1
   where month = v_key and loads < coalesce(v_cap, 0) returning loads into v_used;
  if v_used is null then
    return jsonb_build_object('ok', false, 'reason', 'monthly');
  end if;
  return jsonb_build_object('ok', true, 'used', v_used, 'cap', v_cap);
end;
$fn$;
revoke all on function public.services_gmap_take(text) from public;
grant execute on function public.services_gmap_take(text) to anon, authenticated;

select 'part 5 of 6 done' as "110_part5";
