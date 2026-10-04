-- ===========================================================================
-- 109_part1.sql -- money is paid only to a phone number that has been checked
-- with a one-time code. Needs 102 and 103_parts.
--
-- A person signs in with the phone and a PIN as before. Checking the phone
-- (a code sent by SMS, done once, from the wallet) marks the sign-in account
-- as having a confirmed phone. Rewards and withdrawals need that mark, so a
-- script making accounts with numbers it does not own gets nothing.
-- ===========================================================================

create or replace function public.services_account_phone_ok(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select coalesce((
    select u.phone_confirmed_at is not null
           and right(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g'), 10)
             = right(regexp_replace(coalesce(s.phone, ''), '\D', '', 'g'), 10)
      from public.services_signups s
      join auth.users u on u.id = s.auth_user_id
     where s.id = p_account
  ), false);
$fn$;
revoke all on function public.services_account_phone_ok(uuid) from public, anon, authenticated;

create or replace function public.services_phone_verified()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select public.services_account_phone_ok(public.services_account_id());
$fn$;
revoke all on function public.services_phone_verified() from public, anon;
grant execute on function public.services_phone_verified() to authenticated;

-- Rs 20 to the person whose listing it is: only once the phone is checked.

notify pgrst, 'reload schema';
select 'part 1 of 4 done' as "109_part1";
