-- 233_ride_plan_2.sql -- part 2 of 2: a scheduled ride is busy on every trip day, and completes after its last trip.
create or replace function public.services_worker_busy(p_worker uuid, p_days int default 14, p_exclude uuid default null)
returns table (start_at timestamptz, end_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select s.st, s.st + make_interval(mins => coalesce(b.duration_mins, 60))
    from public.services_bookings b
    cross join lateral generate_series(
      b.start_at,
      case when b.plan_end_at is null then b.start_at else b.plan_end_at - make_interval(mins => coalesce(b.duration_mins, 60)) end,
      case when b.plan_repeat = 'weekly' then interval '7 days' else interval '1 day' end) as s(st)
   where b.worker_id = p_worker and b.id is distinct from p_exclude and b.status = 'accepted' and b.start_at is not null
     and s.st + make_interval(mins => coalesce(b.duration_mins, 60)) > now()
     and s.st < now() + make_interval(days => least(greatest(coalesce(p_days, 14), 1), 60))
   order by s.st;
$fn$;
revoke all on function public.services_worker_busy(uuid, int, uuid) from public;
grant execute on function public.services_worker_busy(uuid, int, uuid) to anon, authenticated;

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
select '233 ride plan part 2 done' as "233_2";
