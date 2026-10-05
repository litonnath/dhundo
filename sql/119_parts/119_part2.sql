-- ===========================================================================
-- 119_part2.sql -- ask for a booking: a start time and a length in minutes.
-- One at a time with the same person: a new request waits until the open
-- one has been answered or has ended.
-- ===========================================================================
drop function if exists public.services_booking_request(uuid, text, date, text);
create or replace function public.services_booking_request(
  p_worker uuid, p_start timestamptz, p_minutes int, p_note text default null)
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
  perform public.services_rate_guard('booking', v_me::text, 20, 86400);
  if p_start is null or p_minutes is null or p_minutes < 5 or p_minutes > 525600
     or p_start < now() - interval '10 minutes' or p_start > now() + interval '365 days' then
    return query select false, 'bad_input'::text;
    return;
  end if;
  if not exists (select 1 from public.services_workers w
                  where w.id = p_worker and w.status = 'approved' and w.user_id <> v_me) then
    return query select false, 'not_found'::text;
    return;
  end if;
  if exists (select 1 from public.services_bookings b
              where b.customer_id = v_me and b.worker_id = p_worker
                and (b.status = 'requested'
                     or (b.status = 'accepted'
                         and b.start_at + make_interval(mins => coalesce(b.duration_mins, 0)) > now()))) then
    return query select false, 'already_open'::text;
    return;
  end if;
  insert into public.services_bookings (customer_id, worker_id, period, start_on, start_at, duration_mins, note)
  values (v_me, p_worker, 'custom', (p_start at time zone 'Asia/Kolkata')::date, p_start, p_minutes,
          left(btrim(coalesce(p_note, '')), 300));
  return query select true, 'requested'::text;
end;
$fn$;
revoke all on function public.services_booking_request(uuid, timestamptz, int, text) from public, anon, authenticated;
grant execute on function public.services_booking_request(uuid, timestamptz, int, text) to authenticated;

select 'part 2 of 3 done' as "119_part2";
