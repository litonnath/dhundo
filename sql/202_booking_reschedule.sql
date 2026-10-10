-- ===========================================================================
-- 202_booking_reschedule.sql -- the worker can move a booking to a new time.
-- The customer sees the new time and gets a chat message saying so.
-- Run after 126, 119 and 201.
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
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('reschedule', v_me::text, 20, 3600);
  select bk.id, bk.status into b
    from public.services_bookings bk
    join public.services_workers w on w.id = bk.worker_id
   where bk.id = p_id and w.user_id = v_me;
  if b.id is null then
    return query select false, 'not_found'::text;
    return;
  end if;
  if b.status not in ('requested', 'accepted') then
    return query select false, 'closed'::text;
    return;
  end if;
  if p_start is null or p_start < now() then
    return query select false, 'bad_time'::text;
    return;
  end if;
  update public.services_bookings set start_at = p_start where id = p_id;
  insert into public.services_chat_messages (booking_id, sender_id, body)
  values (p_id, v_me, 'Rescheduled to ' || to_char(p_start at time zone 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM'));
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_booking_reschedule(uuid, timestamptz) from public, anon;
grant execute on function public.services_booking_reschedule(uuid, timestamptz) to authenticated;
notify pgrst, 'reload schema';
select '202 reschedule done' as "202";
