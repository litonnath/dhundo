-- ===========================================================================
-- 107_profile_location.sql -- the signed-in person own location, kept apart
-- from the location of a listing, and a monthly allowance for road distance.
--   services_signups.home_lat / home_lng / home_exact : where the person is,
--     used as the starting point when they search. A listing has its own.
--   services_gmap_caps row routes : calls to the road-distance function a
--     month. Change: update services_gmap_caps set cap = 3000 where kind = routes;
-- Needs 83 and 100.
-- ===========================================================================
alter table public.services_signups
  add column if not exists home_lat   double precision,
  add column if not exists home_lng   double precision,
  add column if not exists home_exact boolean not null default false;

create or replace function public.services_my_profile()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select jsonb_build_object(
    'full_name', su.full_name, 'phone', su.phone, 'email', su.email,
    'address', su.address, 'city', su.city, 'state', su.state,
    'pincode', su.pincode, 'updated_at', su.profile_updated_at,
    'home_lat', su.home_lat, 'home_lng', su.home_lng, 'home_exact', su.home_exact)
    from public.services_signups su
   where su.auth_user_id = auth.uid();
$fn$;
revoke all on function public.services_my_profile() from public, anon;
grant execute on function public.services_my_profile() to authenticated;

create or replace function public.services_set_home(p_lat double precision, p_lng double precision, p_exact boolean default false)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('home', v_me::text, 60, 3600);
  if p_lat is null and p_lng is null then
    update public.services_signups set home_lat = null, home_lng = null, home_exact = false where id = v_me;
    return query select true, 'cleared'::text;
    return;
  end if;
  if p_lat is null or p_lng is null or p_lat not between 5 and 38 or p_lng not between 67 and 98.5 then
    return query select false, 'bad_position'::text;
    return;
  end if;
  update public.services_signups
     set home_lat = round(p_lat::numeric, 6), home_lng = round(p_lng::numeric, 6),
         home_exact = coalesce(p_exact, false)
   where id = v_me;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_set_home(double precision, double precision, boolean) from public, anon, authenticated;
grant execute on function public.services_set_home(double precision, double precision, boolean) to authenticated;

insert into public.services_gmap_caps (kind, cap) values ('routes', 1500) on conflict do nothing;

notify pgrst, 'reload schema';
select 'done' as "107_profile_location";
