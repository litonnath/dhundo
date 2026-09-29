-- ===========================================================================
-- 92_post_offices.sql
--
-- Tilthai showed PIN 799250 (Dharmanagar). It is in Panisagar, 799260. The
-- PIN was taken as the PIN CENTRE nearest the village, and PIN centres in
-- the postal data are placed only roughly. What the data does say exactly
-- is which post office belongs to which PIN: "Tilthai Nutanbazar B.O" is
-- in 799260. So every post office is kept with its PIN, and a village is
-- matched to its post office by name first.
--
--   services_post_offices           office, cleaned name, PIN, district, state
--   services_load_post_offices(j)   bulk loader (service role only; run
--                                   import_pincodes.py --offices)
--   services_pin_by_office(state, place, district)
--       the PIN of the post office named like the place: exact name first,
--       then a name that starts with it ("Tilthai" -> "Tilthai Nutanbazar").
-- ===========================================================================

create table if not exists public.services_post_offices (
  pincode  text not null,
  office   text not null,
  name     text not null,
  district text,
  state    text not null,
  primary key (state, office, pincode)
);
create index if not exists services_post_offices_name
  on public.services_post_offices (state, lower(name));

alter table public.services_post_offices enable row level security;
revoke all on public.services_post_offices from public, anon, authenticated;

create or replace function public.services_load_post_offices(p_rows jsonb)
returns table (loaded int)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare v_n int;
begin
  insert into public.services_post_offices (pincode, office, name, district, state)
  select x ->> 'pincode', x ->> 'office', x ->> 'name', nullif(x ->> 'district', ''), x ->> 'state'
    from jsonb_array_elements(p_rows) x
   where (x ->> 'pincode') ~ '^[1-9][0-9]{5}$'
     and coalesce(x ->> 'office', '') <> '' and coalesce(x ->> 'name', '') <> ''
     and coalesce(x ->> 'state', '') <> ''
  on conflict (state, office, pincode) do update
     set name = excluded.name, district = excluded.district;
  get diagnostics v_n = row_count;
  return query select v_n;
end;
$fn$;

revoke all on function public.services_load_post_offices(jsonb) from public, anon, authenticated;

create or replace function public.services_pin_by_office(
  p_state text, p_place text, p_district text default null)
returns table (pincode text, place text, district text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  -- place: the town the PIN belongs to (from the PIN list), not the
  -- village office itself, so "In your town" compares towns.
  select o.pincode, coalesce(pc.place, o.name), o.district
    from public.services_post_offices o
    left join public.services_pincodes pc on pc.pincode = o.pincode
   where (p_state is null or o.state = p_state)
     and (p_district is null or o.district is null or o.district = p_district)
     and length(btrim(coalesce(p_place, ''))) >= 3
     and (lower(o.name) = lower(btrim(p_place))
          or lower(o.name) like lower(btrim(p_place)) || ' %')
   order by (lower(o.name) = lower(btrim(p_place))) desc, length(o.name)
   limit 1;
$fn$;

grant execute on function public.services_pin_by_office(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select jsonb_pretty(jsonb_build_object(
  'post_offices_loaded', (select count(*) from public.services_post_offices),
  'tilthai', (select to_jsonb(x) from public.services_pin_by_office('Tripura', 'Tilthai', 'North Tripura') x),
  'expected', 'post_offices_loaded is 0 until import_pincodes.py --offices has run; then tilthai shows its PIN'
)) as "92_verify";
