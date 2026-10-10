-- ===========================================================================
-- 200_profile_photo.sql -- a profile photo on the person's account (not their
-- listing). Shown to a worker on a booking request. Run after 199_inbox_rate.sql.
-- ===========================================================================
alter table public.services_signups add column if not exists avatar_url text;

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
    'home_lat', su.home_lat, 'home_lng', su.home_lng, 'home_exact', su.home_exact,
    'avatar_url', su.avatar_url)
    from public.services_signups su
   where su.auth_user_id = auth.uid();
$fn$;
revoke all on function public.services_my_profile() from public, anon;
grant execute on function public.services_my_profile() to authenticated;

create or replace function public.services_set_my_avatar(p_url text)
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
  perform public.services_rate_guard('avatar', v_me::text, 30, 3600);
  if p_url is not null and (p_url !~ '^https://' or length(p_url) > 600) then
    return query select false, 'bad_url'::text;
    return;
  end if;
  update public.services_signups set avatar_url = nullif(p_url, '') where id = v_me;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_set_my_avatar(text) from public, anon;
grant execute on function public.services_set_my_avatar(text) to authenticated;
notify pgrst, 'reload schema';
select '200 profile photo done' as "200";
