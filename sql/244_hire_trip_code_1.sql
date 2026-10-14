-- 244 part 1 of 2: a driver hired by the hour or day (Hire for work) gets the same start code as a scheduled ride.
-- The customer sees the code, the driver types it in to start. Run 244_hire_trip_code_2.sql next.

create or replace function public.services_booking_needs_code(p_booking uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select coalesce((select coalesce(b.note, '') like 'Scheduled rides.%' or coalesce(t.group_name, '') = 'Drivers'
                     from public.services_bookings b
                     join public.services_workers w on w.id = b.worker_id
                     left join public.services_trades t on t.slug = w.trade_slug
                    where b.id = p_booking), false);
$fn$;
revoke all on function public.services_booking_needs_code(uuid) from public, anon, authenticated;

create or replace function public.services_plan_code(p_booking uuid)
returns table (code text, started boolean, any_started boolean, is_customer boolean, valid_today boolean)
language plpgsql security definer set search_path to 'public' as $fn$
declare v_me uuid := public.services_account_id(); b record; v_ok boolean; v_plan boolean; v_day date := (now() at time zone 'Asia/Kolkata')::date; v_code text;
begin
  select x.*, w.user_id as drv into b from public.services_bookings x join public.services_workers w on w.id = x.worker_id where x.id = p_booking;
  if v_me is null or not found or v_me not in (b.customer_id, b.drv) then return; end if;
  if not public.services_booking_needs_code(p_booking) then return; end if;
  v_plan := coalesce(b.note, '') like 'Scheduled rides.%';
  -- a scheduled ride runs on its days; a driver hired by the hour or day can start any day while it is accepted
  v_ok := b.status = 'accepted' and (not v_plan or public.services_plan_trip_today(b.start_at, b.plan_repeat, b.plan_until));
  if v_ok and v_me = b.customer_id then
    insert into public.services_plan_trips (booking_id, trip_date, code) values (p_booking, v_day, lpad((floor(random() * 10000))::int::text, 4, '0')) on conflict do nothing;
    select t.code into v_code from public.services_plan_trips t where t.booking_id = p_booking and t.trip_date = v_day;
  end if;
  return query select v_code, exists (select 1 from public.services_plan_trips t where t.booking_id = p_booking and t.trip_date = v_day and t.started_at is not null),
    exists (select 1 from public.services_plan_trips t where t.booking_id = p_booking and t.started_at is not null), v_me = b.customer_id, v_ok;
end;
$fn$;
grant execute on function public.services_plan_code(uuid) to authenticated;

create or replace function public.services_plan_verify(p_booking uuid, p_code text)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path to 'public' as $fn$
declare v_me uuid := public.services_account_id(); b record; v_day date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if v_me is null then return query select false, 'sign_in_required'::text; return; end if;
  perform public.services_rate_guard('plan_verify', v_me::text, 30, 3600);
  select x.* into b from public.services_bookings x join public.services_workers w on w.id = x.worker_id and w.user_id = v_me where x.id = p_booking;
  if not found or b.status <> 'accepted' or not public.services_booking_needs_code(p_booking)
     or (coalesce(b.note, '') like 'Scheduled rides.%' and not public.services_plan_trip_today(b.start_at, b.plan_repeat, b.plan_until)) then
    return query select false, 'not_today'::text; return;
  end if;
  update public.services_plan_trips set started_at = coalesce(started_at, now())
   where booking_id = p_booking and trip_date = v_day and code = btrim(coalesce(p_code, ''));
  if not found then return query select false, 'wrong_code'::text; return; end if;
  return query select true, 'started'::text;
end;
$fn$;
grant execute on function public.services_plan_verify(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select '244 part 1 of 2 done' as "244_1";
