-- 156_hardening_part2.sql -- lock an account for 15 minutes after 10 wrong PINs.
-- This is a function for the Supabase password verification hook. After running
-- it, switch it on: Authentication, Hooks, Password verification attempt,
-- choose public.hook_password_verification_attempt. (Needs a plan that offers
-- Auth Hooks; the Supabase dashboard says so on that page.)
create table if not exists public.services_pin_fails (
  user_id  uuid primary key,
  fails    int not null default 0,
  since    timestamptz not null default now(),
  locked_until timestamptz
);
alter table public.services_pin_fails enable row level security;
revoke all on public.services_pin_fails from public, anon, authenticated;
grant all on public.services_pin_fails to supabase_auth_admin;

create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_user uuid := (event ->> 'user_id')::uuid;
  v_valid boolean := coalesce((event ->> 'valid')::boolean, false);
  r public.services_pin_fails%rowtype;
begin
  select * into r from public.services_pin_fails where user_id = v_user;
  if found and r.locked_until is not null and r.locked_until > now() then
    return jsonb_build_object('decision', 'reject',
      'message', 'Too many wrong PINs. Please try again in 15 minutes.');
  end if;
  if v_valid then
    delete from public.services_pin_fails where user_id = v_user;
    return jsonb_build_object('decision', 'continue');
  end if;
  insert into public.services_pin_fails (user_id, fails, since)
  values (v_user, 1, now())
  on conflict (user_id) do update
     set fails = case when public.services_pin_fails.since < now() - interval '15 minutes' then 1 else public.services_pin_fails.fails + 1 end,
         since = case when public.services_pin_fails.since < now() - interval '15 minutes' then now() else public.services_pin_fails.since end,
         locked_until = case when public.services_pin_fails.since >= now() - interval '15 minutes' and public.services_pin_fails.fails + 1 >= 10
                             then now() + interval '15 minutes' else null end;
  return jsonb_build_object('decision', 'continue');
end;
$fn$;
revoke all on function public.hook_password_verification_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
select 'hardening part 2 done' as "156_part2";
