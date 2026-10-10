-- ===========================================================================
-- 203_worker_busy.sql -- the times a worker is already booked (accepted
-- bookings only), so a customer can see when to book. Only the time slots
-- are shown: no names, places or amounts. Run after 201.
-- ===========================================================================
create or replace function public.services_worker_busy(p_worker uuid, p_days int default 14)
returns table (start_at timestamptz, end_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select b.start_at, b.start_at + make_interval(mins => coalesce(b.duration_mins, 60))
    from public.services_bookings b
   where b.worker_id = p_worker and b.status = 'accepted' and b.start_at is not null
     and b.start_at + make_interval(mins => coalesce(b.duration_mins, 60)) > now()
     and b.start_at < now() + make_interval(days => least(greatest(coalesce(p_days, 14), 1), 60))
   order by b.start_at;
$fn$;
revoke all on function public.services_worker_busy(uuid, int) from public;
grant execute on function public.services_worker_busy(uuid, int) to anon, authenticated;
notify pgrst, 'reload schema';
select '203 worker busy done' as "203";
