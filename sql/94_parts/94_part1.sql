-- 94 part 1 of 2: an exact position that did not come from the phone GPS.
-- A pin placed on the map, or a place chosen from the search, is stored as
-- picked. Needs 93 already run. Safe to run again.

do $b$
declare
  v_allowed text[];
  v_list    text;
begin
  select array_agg(distinct v order by v) into v_allowed
    from (
      select unnest(array['device', 'pin', 'city', 'area', 'picked']) as v
      union
      select loc_source from public.services_workers where loc_source is not null
    ) s;
  select string_agg(quote_literal(v), ', ') into v_list from unnest(v_allowed) v;
  alter table public.services_workers
    drop constraint if exists services_workers_loc_source_check;
  execute format(
    'alter table public.services_workers add constraint services_workers_loc_source_check
       check (loc_source is null or loc_source in (%s))', v_list);
end $b$;

create or replace function public.services_set_my_position(
  p_lat double precision, p_lng double precision, p_source text default 'picked')
returns jsonb language plpgsql volatile security definer
set search_path to 'public' as $fn$
declare
  v_me  uuid := public.services_account_id();
  v_src text := case when p_source = 'device' then 'device' else 'picked' end;
  v_n   int;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in_required');
  end if;
  if p_lat is null or p_lng is null
     or p_lat not between 5 and 38 or p_lng not between 67 and 99 then
    return jsonb_build_object('ok', false, 'reason', 'bad_location');
  end if;
  perform public.services_rate_guard('position', v_me::text, 30, 3600);
  update public.services_workers
     set lat = p_lat, lng = p_lng, loc_source = v_src
   where user_id = v_me;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_listing');
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.services_set_my_position(double precision, double precision, text)
  from public, anon, authenticated;
grant execute on function public.services_set_my_position(double precision, double precision, text)
  to authenticated;

notify pgrst, 'reload schema';
select 'part 1 done' as "94_part1";
