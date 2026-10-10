-- ===========================================================================
-- 207_booking_reports.sql -- report abuse on a booking, from the customer or
-- the worker. The admin sees who reported whom, with both phone numbers so
-- they can reach either. The report keeps names and the booking time, so it
-- survives the booking being deleted. Run after 126 and 201.
-- ===========================================================================
create table if not exists public.services_booking_reports (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid,
  reporter_id   uuid not null references public.services_signups(id) on delete cascade,
  reporter_role text not null check (reporter_role in ('customer', 'worker')),
  reason        text not null check (char_length(reason) between 2 and 60),
  note          text check (note is null or char_length(note) <= 500),
  customer_name text, customer_phone text, worker_name text, worker_phone text,
  start_at      timestamptz,
  status        text not null default 'open' check (status in ('open', 'resolved')),
  created_at    timestamptz not null default now()
);
alter table public.services_booking_reports enable row level security;
revoke all on public.services_booking_reports from public, anon, authenticated;

create or replace function public.services_booking_report(p_id uuid, p_reason text, p_note text default null)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  b record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('bkreport', v_me::text, 10, 86400);
  if length(btrim(coalesce(p_reason, ''))) < 2 then
    return query select false, 'bad_input'::text;
    return;
  end if;
  select bk.id, bk.start_at, bk.customer_id, w.user_id as wacct,
         coalesce(nullif(w.business_name, ''), w.full_name) as wname, w.phone as wphone,
         c.full_name as cname, c.phone as cphone into b
    from public.services_bookings bk
    join public.services_workers w on w.id = bk.worker_id
    join public.services_signups c on c.id = bk.customer_id
   where bk.id = p_id and (bk.customer_id = v_me or w.user_id = v_me);
  if b.id is null then
    return query select false, 'not_found'::text;
    return;
  end if;
  insert into public.services_booking_reports (booking_id, reporter_id, reporter_role, reason, note,
         customer_name, customer_phone, worker_name, worker_phone, start_at)
  values (b.id, v_me, case when b.customer_id = v_me then 'customer' else 'worker' end,
          left(btrim(p_reason), 60), nullif(left(btrim(coalesce(p_note, '')), 500), ''),
          b.cname, b.cphone, b.wname, b.wphone, b.start_at);
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_booking_report(uuid, text, text) from public, anon;
grant execute on function public.services_booking_report(uuid, text, text) to authenticated;

create or replace function public.services_admin_booking_reports(p_status text default 'open')
returns table (id uuid, reporter_role text, reason text, note text, customer_name text, customer_phone text,
               worker_name text, worker_phone text, start_at timestamptz, status text, created_at timestamptz)
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
    select r.id, r.reporter_role, r.reason, r.note, r.customer_name, r.customer_phone,
           r.worker_name, r.worker_phone, r.start_at, r.status, r.created_at
      from public.services_booking_reports r
     where p_status = 'all' or r.status = p_status
     order by r.created_at desc limit 200;
end;
$fn$;
revoke all on function public.services_admin_booking_reports(text) from public, anon;
grant execute on function public.services_admin_booking_reports(text) to authenticated;

create or replace function public.services_admin_booking_report_resolve(p_id uuid)
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  update public.services_booking_reports set status = 'resolved' where id = p_id;
  return query select true;
end;
$fn$;
revoke all on function public.services_admin_booking_report_resolve(uuid) from public, anon;
grant execute on function public.services_admin_booking_report_resolve(uuid) to authenticated;
notify pgrst, 'reload schema';
select '207 booking reports done' as "207";
