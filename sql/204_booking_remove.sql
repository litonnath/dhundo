-- ===========================================================================
-- 204_booking_remove.sql -- either person can delete a booking. It is removed
-- at once for both sides, with its chat. Run after 126 and 201.
-- ===========================================================================
create table if not exists public.services_booking_notices (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.services_signups(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table public.services_booking_notices enable row level security;
revoke all on public.services_booking_notices from public, anon, authenticated;

create or replace function public.services_booking_remove(p_id uuid)
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
  perform public.services_rate_guard('bkremove', v_me::text, 60, 3600);
  select bk.id, bk.status, bk.start_at, bk.customer_id, w.user_id as wacct,
         coalesce(nullif(w.business_name, ''), w.full_name) as wname,
         (select c.full_name from public.services_signups c where c.id = bk.customer_id) as cname into b
    from public.services_bookings bk
    join public.services_workers w on w.id = bk.worker_id
   where bk.id = p_id and (bk.customer_id = v_me or w.user_id = v_me);
  if b.id is null then
    return query select false, 'not_found'::text;
    return;
  end if;
  insert into public.services_booking_notices (account_id, body)
  values (case when b.customer_id = v_me then b.wacct else b.customer_id end,
          coalesce(case when b.customer_id = v_me then b.cname else b.wname end, 'The other person')
          || ' deleted the booking' || coalesce(' for ' || to_char(b.start_at at time zone 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM'), ''));
  delete from public.services_bookings where id = p_id;
  return query select true, 'deleted'::text;
end;
$fn$;
revoke all on function public.services_booking_remove(uuid) from public, anon;
grant execute on function public.services_booking_remove(uuid) to authenticated;

create or replace function public.services_my_booking_notices()
returns table (id uuid, body text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select n.id, n.body, n.created_at from public.services_booking_notices n
   where n.account_id = public.services_account_id() and n.created_at > now() - interval '7 days'
   order by n.created_at desc;
$fn$;
revoke all on function public.services_my_booking_notices() from public, anon;
grant execute on function public.services_my_booking_notices() to authenticated;

create or replace function public.services_booking_notice_dismiss(p_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $fn$
  delete from public.services_booking_notices where id = p_id and account_id = public.services_account_id();
$fn$;
revoke all on function public.services_booking_notice_dismiss(uuid) from public, anon;
grant execute on function public.services_booking_notice_dismiss(uuid) to authenticated;
notify pgrst, 'reload schema';
select '204 booking remove done' as "204";
