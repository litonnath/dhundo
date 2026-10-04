-- ===========================================================================
-- 105_part2.sql -- admin access log (kept one year) and retention clean-up.
-- ===========================================================================
create table if not exists public.services_access_log (
  id         bigint generated always as identity primary key,
  admin_id   uuid,
  worker_id  uuid,
  what       text not null,
  at         timestamptz not null default now()
);
create index if not exists services_access_log_at_idx on public.services_access_log (at);
alter table public.services_access_log enable row level security;
revoke all on public.services_access_log from public, anon, authenticated;

-- The admin screen calls this when it opens a listing, an ID photo or a
-- phone number. what is one of: listing, id_document, phone.
create or replace function public.services_log_admin_access(p_worker_id uuid, p_what text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    return;
  end if;
  insert into public.services_access_log (admin_id, worker_id, what)
  values (public.services_account_id(), p_worker_id,
          case when p_what in ('listing', 'id_document', 'phone') then p_what else 'other' end);
end;
$fn$;
revoke all on function public.services_log_admin_access(uuid, text) from public, anon, authenticated;
grant execute on function public.services_log_admin_access(uuid, text) to authenticated;

-- The admin can read the log.
create or replace function public.services_admin_access_log(p_days int default 30)
returns table (at timestamptz, admin_id uuid, worker_id uuid, what text)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  return query
    select l.at, l.admin_id, l.worker_id, l.what from public.services_access_log l
     where l.at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 400)))
     order by l.at desc limit 500;
end;
$fn$;
revoke all on function public.services_admin_access_log(int) from public, anon, authenticated;
grant execute on function public.services_admin_access_log(int) to authenticated;

-- Retention, written in one place:
--   access log            1 year
--   blocked phone numbers 1 year after the block (stops a deleted account
--                         being recreated at once, then the number is let go)
--   closed data requests  3 years (proof the request was answered)
--   consent log           the life of the account, then deleted with it
--   wallet and payouts    8 years (accounting records), see the notice
-- Run it by hand now and then, or schedule it in Supabase (Database, Cron).
create or replace function public.services_purge_old()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  a int;
  b int;
  c int;
begin
  delete from public.services_access_log where at < now() - interval '1 year';
  get diagnostics a = row_count;
  delete from public.services_blocked_phones where blocked_at < now() - interval '1 year';
  get diagnostics b = row_count;
  delete from public.services_privacy_requests
   where status = 'done' and closed_at < now() - interval '3 years';
  get diagnostics c = row_count;
  return jsonb_build_object('access_log', a, 'blocked_phones', b, 'requests', c);
end;
$fn$;
revoke all on function public.services_purge_old() from public, anon, authenticated;

notify pgrst, 'reload schema';
select 'done' as "105_part2";
