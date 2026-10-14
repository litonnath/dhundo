-- 247: reset a forgotten PIN after the phone number is proved by an SMS code (pin-reset function).
-- Finds the sign-in account of a phone number. Only the server function (service role) can call it.
create or replace function public.services_pin_reset_target(p_email text)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select u.id from auth.users u where lower(u.email) = lower(btrim(coalesce(p_email, ''))) limit 1;
$fn$;
revoke all on function public.services_pin_reset_target(text) from public, anon, authenticated;
grant execute on function public.services_pin_reset_target(text) to service_role;
notify pgrst, 'reload schema';
select '247 done' as "247_pin_reset";
