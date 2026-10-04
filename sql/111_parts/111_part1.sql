-- ===========================================================================
-- 111_part1.sql -- admin two-step sign-in (an authenticator app code).
-- The existing services_is_admin() is renamed services_is_admin_base() and a
-- new services_is_admin() wraps it: still the same answer, plus, when the
-- setting admin_needs_mfa is on, the sign-in must have passed the
-- authenticator code (aal2). Every admin function keeps calling
-- services_is_admin() by name, so all of them are covered at once.
-- It is OFF until each admin has enrolled in the app. Switch on with:
--   update services_settings set value = ON where name = ADMIN_NEEDS_MFA (in quotes);
-- Needs 110_part1 (the settings table).
-- ===========================================================================
do $fn$
begin
  if to_regprocedure('public.services_is_admin_base()') is null then
    alter function public.services_is_admin() rename to services_is_admin_base;
  end if;
end;
$fn$;

insert into public.services_settings (name, value) values ('admin_needs_mfa', 'off')
  on conflict do nothing;

create or replace function public.services_is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select public.services_is_admin_base()
     and (coalesce(public.services_setting('admin_needs_mfa'), 'off') <> 'on'
          or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2');
$fn$;
revoke all on function public.services_is_admin() from public, anon;
grant execute on function public.services_is_admin() to authenticated;
revoke all on function public.services_is_admin_base() from public, anon, authenticated;

select 'part 1 of 2 done' as "111_part1";
