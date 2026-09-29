-- ===========================================================================
-- 83_account_profile.sql
--
-- A profile for every account, separate from a listing.
--   PROFILE: who the person is. Name, email, address, town, state, PIN.
--            Every signed-in person has one, customer or worker.
--   LISTING: the work they do or the shop they run, shown to customers.
--            Only people who offer work make one.
--
-- Adds the columns to services_signups and two functions:
--   services_my_profile()          read your own profile
--   services_update_my_profile()   save it
-- Safe to run again.
-- ===========================================================================

alter table public.services_signups
  add column if not exists email      text,
  add column if not exists address    text,
  add column if not exists city       text,
  add column if not exists state      text,
  add column if not exists pincode    text,
  add column if not exists profile_updated_at timestamptz;

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
    'pincode', su.pincode, 'updated_at', su.profile_updated_at)
    from public.services_signups su
   where su.auth_user_id = auth.uid();
$fn$;

create or replace function public.services_update_my_profile(
  p_full_name text,
  p_email     text default null,
  p_address   text default null,
  p_city      text default null,
  p_state     text default null,
  p_pincode   text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_name  text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_pin   text := nullif(regexp_replace(coalesce(p_pincode, ''), '\D', '', 'g'), '');
  v_state text := nullif(btrim(coalesce(p_state, '')), '');
  v_reason text := null;
begin
  if auth.uid() is null then
    v_reason := 'sign_in_required';
  elsif v_name is null or length(v_name) > 80 then
    v_reason := 'bad_name';
  elsif v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    v_reason := 'bad_email';
  elsif v_pin is not null and v_pin !~ '^[1-9][0-9]{5}$' then
    v_reason := 'bad_pincode';
  elsif v_state is not null and not public.services_is_state(v_state) then
    v_reason := 'bad_state';
  end if;

  if v_reason is null then
    update public.services_signups su
       set full_name = v_name,
           email     = v_email,
           address   = left(nullif(btrim(coalesce(p_address, '')), ''), 300),
           city      = left(nullif(btrim(coalesce(p_city, '')), ''), 80),
           state     = v_state,
           pincode   = v_pin,
           profile_updated_at = now()
     where su.auth_user_id = auth.uid();
    if not found then v_reason := 'no_account'; end if;
  end if;

  if v_reason is not null then
    return jsonb_build_object('ok', false, 'reason', v_reason);
  end if;
  return jsonb_build_object('ok', true, 'profile', public.services_my_profile());
end;
$fn$;

revoke all on function public.services_my_profile() from public, anon;
grant execute on function public.services_my_profile() to authenticated;
revoke all on function public.services_update_my_profile(text, text, text, text, text, text) from public, anon;
grant execute on function public.services_update_my_profile(text, text, text, text, text, text) to authenticated;

select jsonb_pretty(jsonb_build_object(
  'columns', (select jsonb_agg(column_name order by column_name)
                from information_schema.columns
               where table_schema = 'public' and table_name = 'services_signups'
                 and column_name in ('email','address','city','state','pincode','profile_updated_at')),
  'functions', (select jsonb_agg(proname order by proname) from pg_proc
                 where proname in ('services_my_profile','services_update_my_profile')),
  'expected', '6 columns and 2 functions'
)) as "83_verify";
