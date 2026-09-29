-- ===========================================================================
-- 90_pin_by_name.sql
--
-- Picking a village could leave the PIN code empty: the PIN was worked out
-- only from the village position, and some villages in the list have no
-- position, or none near a PIN code centre. This finds a PIN code by NAME
-- as well: the post office of that name, in that state (and district when
-- given), or failing that the PIN nearest the same-named place that does
-- have a position.
--
--   services_pin_by_name(state, place, district)  -> pincode, place, lat, lng
-- ===========================================================================

create index if not exists services_pincodes_lplace
  on public.services_pincodes (lower(place));

create or replace function public.services_pin_by_name(
  p_state text, p_place text, p_district text default null)
returns table (pincode text, place text, district text, lat double precision, lng double precision)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_name text := lower(btrim(coalesce(p_place, '')));
  v_lat double precision;
  v_lng double precision;
begin
  if length(v_name) < 2 then return; end if;

  -- 1. A PIN code whose own place has that name.
  -- When the district is known it must match: a Padmapur in another
  -- district is another village, with another PIN code.
  return query
  select pc.pincode, pc.place, pc.district, pc.lat, pc.lng
    from public.services_pincodes pc
   where lower(pc.place) = v_name
     and (p_state is null or pc.state = p_state)
     and (p_district is null or pc.district is null or pc.district = p_district)
   limit 1;
  if found then return; end if;

  -- 2. The same-named place with a position, then the PIN nearest it.
  select r.lat, r.lng into v_lat, v_lng
    from public.services_regions r
   where lower(r.place) = v_name and r.lat is not null
     and (p_state is null or r.state = p_state)
     and (p_district is null or r.district is null or r.district = p_district)
   order by (r.district = p_district) desc nulls last
   limit 1;
  if v_lat is null then return; end if;

  return query
  select pc.pincode, pc.place, pc.district, pc.lat, pc.lng
    from public.services_pincodes pc
   where pc.lat between v_lat - 0.25 and v_lat + 0.25
     and pc.lng between v_lng - 0.25 and v_lng + 0.25
   order by public.services_km(v_lat, v_lng, pc.lat, pc.lng)
   limit 1;
end;
$fn$;

grant execute on function public.services_pin_by_name(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select jsonb_pretty(jsonb_build_object(
  'padmapur', (select to_jsonb(x) from public.services_pin_by_name('Tripura', 'Padmapur', 'North Tripura') x),
  'dharmanagar', (select to_jsonb(x) from public.services_pin_by_name('Tripura', 'Dharmanagar') x),
  'expected', 'a PIN code for each'
)) as "90_verify";
