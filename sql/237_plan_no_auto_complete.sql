-- 237_plan_no_auto_complete.sql -- a scheduled ride is completed only by the rider ("Ride completed" after the trip
-- code), never by the clock. Other bookings still complete by themselves when their time is up.
create or replace function public.services_bookings_complete_due()
returns int
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  r record;
  n int := 0;
begin
  for r in
    update public.services_bookings b
       set status = 'completed'
      from public.services_workers w
     where w.id = b.worker_id and b.status = 'accepted'
       and b.start_at is not null and b.duration_mins is not null
       and coalesce(b.plan_end_at, b.start_at + make_interval(mins => b.duration_mins)) < now()
       and coalesce(b.note, '') not like 'Scheduled rides.%'
    returning b.id, b.customer_id, w.user_id as worker_account
  loop
    insert into public.services_chat_messages (booking_id, sender_id, body)
    values (r.id, r.customer_id, 'Completed'), (r.id, r.worker_account, 'Completed');
    n := n + 1;
  end loop;
  return n;
end;
$fn$;
revoke all on function public.services_bookings_complete_due() from public, anon;
grant execute on function public.services_bookings_complete_due() to authenticated;
notify pgrst, 'reload schema';
select '237 done' as "237";
