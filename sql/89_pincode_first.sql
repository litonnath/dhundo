-- ===========================================================================
-- 89_pincode_first.sql
--
-- Results by PIN code: everybody in the customer PIN code first, then
-- everybody else nearest first. A PIN code is something every person knows,
-- and "same PIN" is easy to trust where a village position can be rough.
--
--   services_pin_near(lat, lng)   the PIN code nearest a position
--   services_pin_workers(pin, trade, group, lat, lng, limit)
--       the listings in that PIN code, as the same cards the search returns.
--       A listing with no PIN of its own counts in the PIN nearest to it.
-- ===========================================================================

create index if not exists services_pincodes_latlng
  on public.services_pincodes (lat, lng) where lat is not null;

create or replace function public.services_pin_near(p_lat double precision, p_lng double precision)
returns table (pincode text, place text, district text, km double precision)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select pc.pincode, pc.place, pc.district,
         round(public.services_km(p_lat, p_lng, pc.lat, pc.lng)::numeric, 1)::double precision
    from public.services_pincodes pc
   where p_lat is not null and p_lng is not null
     and pc.lat between p_lat - 0.25 and p_lat + 0.25
     and pc.lng between p_lng - 0.25 and p_lng + 0.25
   order by public.services_km(p_lat, p_lng, pc.lat, pc.lng)
   limit 1;
$fn$;

create or replace function public.services_pin_workers(
  p_pin text, p_trade text default null, p_group text default null,
  p_lat double precision default null, p_lng double precision default null,
  p_limit int default 50)
returns setof jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_pin text := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
  r record;
  v jsonb;
  n int := 0;
begin
  if length(v_pin) <> 6 then return; end if;
  for r in
    select w.id, w.state, w.lat, w.lng
      from public.services_workers w
     where w.status = 'approved' and coalesce(w.available, true)
       and (regexp_replace(coalesce(w.pincode, ''), '\D', '', 'g') = v_pin
            or (coalesce(btrim(w.pincode), '') = '' and w.lat is not null
                and (select x.pincode from public.services_pin_near(w.lat, w.lng) x) = v_pin))
  loop
    exit when n >= greatest(1, least(coalesce(p_limit, 50), 100));
    -- The card, exactly as the search builds it, looked up next to the
    -- listing itself so it is certainly within the first page.
    execute format(
      'select to_jsonb(b) from public.services_browse_workers(
          p_trade := %L, p_locality := NULL, p_search := NULL, p_group := %L,
          p_kind := NULL, p_state := %L, p_limit := 50, p_offset := 0,
          p_lat := %L, p_lng := %L, p_radius_km := NULL) b
        where b.id = %L limit 1',
      p_trade, p_group, r.state, r.lat, r.lng, r.id)
      into v;
    continue when v is null;
    n := n + 1;
    return next (v - 'total_count') || jsonb_build_object(
      'same_pin', v_pin,
      'distance_km', case when p_lat is null or r.lat is null then null
                          else to_jsonb(round(public.services_km(p_lat, p_lng, r.lat, r.lng)::numeric, 1)) end);
  end loop;
end;
$fn$;

grant execute on function public.services_pin_near(double precision, double precision) to anon, authenticated;
grant execute on function public.services_pin_workers(text, text, text, double precision, double precision, int)
  to anon, authenticated;

notify pgrst, 'reload schema';

select jsonb_pretty(jsonb_build_object(
  'pin_near_dharmanagar', (select to_jsonb(x) from public.services_pin_near(24.3667, 92.1667) x),
  'listings_with_a_pin', (select count(*) from public.services_workers
                           where coalesce(btrim(pincode), '') <> ''),
  'listings_without_a_pin', (select count(*) from public.services_workers
                              where coalesce(btrim(pincode), '') = ''),
  'expected', 'a PIN code for Dharmanagar, and the counts'
)) as "89_verify";
