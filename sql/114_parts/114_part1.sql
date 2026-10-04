-- ===========================================================================
-- 114_part1.sql -- BOOKINGS. A customer asks a worker to be booked for a
-- week, a month, three months or a year from a start date; the worker
-- accepts or declines. The app records the agreement and nothing more: the
-- pay is agreed between the two and paid outside the app.
-- Needs 93 (services_rate_guard).
-- ===========================================================================
create table if not exists public.services_bookings (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.services_signups(id) on delete cascade,
  worker_id   uuid not null references public.services_workers(id) on delete cascade,
  period      text not null check (period in ('week', 'month', 'quarter', 'year')),
  start_on    date not null,
  note        text check (note is null or char_length(note) <= 300),
  status      text not null default 'requested'
              check (status in ('requested', 'accepted', 'declined', 'cancelled')),
  created_at  timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists services_bookings_worker_idx on public.services_bookings (worker_id, status);
create index if not exists services_bookings_customer_idx on public.services_bookings (customer_id, created_at desc);
create unique index if not exists services_bookings_one_open
  on public.services_bookings (customer_id, worker_id) where status in ('requested', 'accepted');
alter table public.services_bookings enable row level security;
revoke all on public.services_bookings from public, anon, authenticated;

create or replace function public.services_booking_request(p_worker uuid, p_period text, p_start date, p_note text default null)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('booking', v_me::text, 10, 86400);
  if p_period not in ('week', 'month', 'quarter', 'year') or p_start is null
     or p_start < current_date or p_start > current_date + 365 then
    return query select false, 'bad_input'::text;
    return;
  end if;
  if not exists (select 1 from public.services_workers w
                  where w.id = p_worker and w.status = 'approved' and w.user_id <> v_me) then
    return query select false, 'not_found'::text;
    return;
  end if;
  begin
    insert into public.services_bookings (customer_id, worker_id, period, start_on, note)
    values (v_me, p_worker, p_period, p_start, left(btrim(coalesce(p_note, '')), 300));
  exception when unique_violation then
    return query select false, 'already_open'::text;
    return;
  end;
  return query select true, 'requested'::text;
end;
$fn$;
revoke all on function public.services_booking_request(uuid, text, date, text) from public, anon, authenticated;
grant execute on function public.services_booking_request(uuid, text, date, text) to authenticated;

select 'part 1 of 3 done' as "114_part1";
