-- 242: keep the data we hold small. Adds unused phone-check rows to the monthly purge and
-- schedules it (needs the pg_cron extension: Supabase, Database, Extensions, pg_cron).
create or replace function public.services_purge_old()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  a int; b int; c int; d int; e int;
begin
  delete from public.services_access_log where at < now() - interval '1 year';
  get diagnostics a = row_count;
  delete from public.services_blocked_phones where blocked_at < now() - interval '1 year';
  get diagnostics b = row_count;
  delete from public.services_privacy_requests
   where status = 'done' and closed_at < now() - interval '3 years';
  get diagnostics c = row_count;
  -- phone-check leftovers: a code nobody used must not keep a phone number
  delete from public.services_phone_claims where expires_at < now() - interval '1 day';
  get diagnostics d = row_count;
  delete from public.services_phone_otps where expires_at < now() - interval '1 day';
  get diagnostics e = row_count;
  return jsonb_build_object('access_log', a, 'blocked_phones', b, 'requests', c, 'phone_claims', d, 'phone_otps', e);
end;
$fn$;
revoke all on function public.services_purge_old() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'dhundo-purge-old';
    perform cron.schedule('dhundo-purge-old', '30 2 * * *', 'select public.services_purge_old()');
    raise notice 'purge scheduled every night at 02:30';
  else
    raise notice 'pg_cron is not on: enable it under Database, Extensions, then run this file again';
  end if;
end $$;

notify pgrst, 'reload schema';
select '242 done' as "242_privacy_purge";
