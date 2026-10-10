-- ===========================================================================
-- 202_booking_reschedule.sql -- the customer or the worker can move a booking
-- to a new time. A time the worker is already booked for (an accepted booking
-- that overlaps) is refused. If the customer moves an accepted booking it goes
-- back to waiting for the worker's yes; if the worker moves it, it stays.
-- The other side sees the new time, the old one, and a chat message.
-- Run after 199 and 201.
-- ===========================================================================
create or replace function public.services_booking_reschedule(p_id uuid, p_start timestamptz)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  b record;
  v_role text;
  v_len int;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('reschedule', v_me::text, 20, 3600);
  select bk.id, bk.status, bk.start_at, bk.duration_mins, bk.worker_id, bk.customer_id, w.user_id as wacct into b
    from public.services_bookings bk
    join public.services_workers w on w.id = bk.worker_id
   where bk.id = p_id and (bk.customer_id = v_me or w.user_id = v_me);
  if b.id is null then
    return query select false, 'not_found'::text;
    return;
  end if;
  v_role := case when b.customer_id = v_me then 'customer' else 'worker' end;
  if b.status not in ('requested', 'accepted') then
    return query select false, 'closed'::text;
    return;
  end if;
  if p_start is null or p_start < now() then
    return query select false, 'bad_time'::text;
    return;
  end if;
  v_len := coalesce(b.duration_mins, 60);
  if exists (select 1 from public.services_bookings o
              where o.worker_id = b.worker_id and o.id <> b.id and o.status = 'accepted'
                and o.start_at is not null
                and o.start_at < p_start + make_interval(mins => v_len)
                and o.start_at + make_interval(mins => coalesce(o.duration_mins, 60)) > p_start) then
    return query select false, 'worker_busy'::text;
    return;
  end if;
  update public.services_bookings
     set prev_start_at = start_at, start_at = p_start, resched_by = v_role,
         status = case when v_role = 'customer' and status = 'accepted' then 'requested' else status end
   where id = p_id;
  insert into public.services_chat_messages (booking_id, sender_id, body)
  values (p_id, v_me, (case when v_role = 'customer' then 'Asked to move to ' else 'Rescheduled to ' end)
         || to_char(p_start at time zone 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM'));
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_booking_reschedule(uuid, timestamptz) from public, anon;
grant execute on function public.services_booking_reschedule(uuid, timestamptz) to authenticated;
notify pgrst, 'reload schema';
select '202 reschedule done' as "202";
