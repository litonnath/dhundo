-- ===========================================================================
-- 201_booking_complete.sql -- when a booking's time is over (start + hours),
-- it ends by itself: status becomes 'completed', the chat closes, and both
-- people get a "Completed" message. The app calls this while it is open; with
-- pg_cron you can also run it every minute:
--   select cron.schedule('dhundo-bookings-complete', '* * * * *', 'select public.services_bookings_complete_due()');
-- Run after 126 and 199.
-- ===========================================================================
do $do$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.services_bookings'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%declined%' loop
    execute format('alter table public.services_bookings drop constraint %I', c.conname);
  end loop;
end
$do$;
alter table public.services_bookings add constraint services_bookings_status_check
  check (status in ('requested', 'accepted', 'declined', 'cancelled', 'completed'));

create or replace function public.services_bookings_stamp_closed()
returns trigger
language plpgsql
as $fn$
begin
  if new.status in ('declined', 'cancelled', 'completed') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.closed_at := now();
  end if;
  return new;
end;
$fn$;

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
       and b.start_at + make_interval(mins => b.duration_mins) < now()
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
select '201 booking complete done' as "201";
