-- 154_timed_pause.sql -- pause orders for a set time and resume by itself.
alter table public.services_workers add column if not exists resume_at timestamptz;

drop function if exists public.services_pause_orders(int);
create function public.services_pause_orders(p_minutes int)
returns table (ok boolean, resume_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare v_acc uuid := public.services_account_id(); v_at timestamptz;
begin
  if v_acc is null then return query select false, null::timestamptz; return; end if;
  v_at := now() + make_interval(mins => greatest(5, least(coalesce(p_minutes, 30), 1440)));
  update public.services_workers w set accepting_orders = false, resume_at = v_at where w.user_id = v_acc;
  return query select true, v_at;
end;
$fn$;
revoke all on function public.services_pause_orders(int) from public, anon, authenticated;
grant execute on function public.services_pause_orders(int) to authenticated;

-- Opens every shop whose pause has ended. Safe to call any time.
drop function if exists public.services_resume_due();
create function public.services_resume_due()
returns int
language sql
security definer
set search_path to 'public'
as $fn$
  with u as (
    update public.services_workers w set accepting_orders = true, resume_at = null
     where w.resume_at is not null and w.resume_at <= now() returning 1)
  select count(*)::int from u;
$fn$;
revoke all on function public.services_resume_due() from public;
grant execute on function public.services_resume_due() to anon, authenticated;

-- Resume by itself every minute when pg_cron is switched on (Database,
-- Extensions in Supabase). If it is not, the app calls the function.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('dhundo-resume-orders', '* * * * *', 'select public.services_resume_due()');
exception when others then
  raise notice 'pg_cron not available; the app will resume shops when it is opened';
end $$;

drop function if exists public.services_my_resume();
create function public.services_my_resume()
returns timestamptz
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.resume_at from public.services_workers w where w.user_id = public.services_account_id() limit 1;
$fn$;
revoke all on function public.services_my_resume() from public, anon, authenticated;
grant execute on function public.services_my_resume() to authenticated;
notify pgrst, 'reload schema';
select 'timed pause ready' as "154";
