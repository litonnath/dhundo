-- 235_plan_code_1.sql -- a four digit code for each trip of a scheduled ride. The customer shows it; the rider
-- types it in to start the trip. Part 1 of 2; run 235_plan_code_2.sql next.
create table if not exists public.services_plan_trips (
  booking_id uuid not null references public.services_bookings(id) on delete cascade,
  trip_date date not null,
  code text not null,
  started_at timestamptz,
  primary key (booking_id, trip_date)
);
alter table public.services_plan_trips enable row level security;
revoke all on public.services_plan_trips from public, anon, authenticated;

create or replace function public.services_plan_trip_today(p_start timestamptz, p_repeat text, p_until date)
returns boolean language sql stable as $fn$
  select case
    when p_repeat is null or p_repeat = 'once' then (now() at time zone 'Asia/Kolkata')::date = (p_start at time zone 'Asia/Kolkata')::date
    else (now() at time zone 'Asia/Kolkata')::date between (p_start at time zone 'Asia/Kolkata')::date and coalesce(p_until, (p_start at time zone 'Asia/Kolkata')::date)
         and (p_repeat = 'daily' or ((now() at time zone 'Asia/Kolkata')::date - (p_start at time zone 'Asia/Kolkata')::date) % 7 = 0)
  end
$fn$;

create or replace function public.services_plan_code(p_booking uuid)
returns table (code text, started boolean, any_started boolean, is_customer boolean, valid_today boolean)
language plpgsql security definer set search_path to 'public' as $fn$
declare v_me uuid := public.services_account_id(); b record; v_ok boolean; v_day date := (now() at time zone 'Asia/Kolkata')::date; v_code text;
begin
  select x.*, w.user_id as drv into b from public.services_bookings x join public.services_workers w on w.id = x.worker_id where x.id = p_booking;
  if v_me is null or not found or v_me not in (b.customer_id, b.drv) then return; end if;
  v_ok := b.status = 'accepted' and public.services_plan_trip_today(b.start_at, b.plan_repeat, b.plan_until);
  if v_ok and v_me = b.customer_id then
    insert into public.services_plan_trips (booking_id, trip_date, code) values (p_booking, v_day, lpad((floor(random() * 10000))::int::text, 4, '0')) on conflict do nothing;
    select t.code into v_code from public.services_plan_trips t where t.booking_id = p_booking and t.trip_date = v_day;
  end if;
  return query select v_code, exists (select 1 from public.services_plan_trips t where t.booking_id = p_booking and t.trip_date = v_day and t.started_at is not null),
    exists (select 1 from public.services_plan_trips t where t.booking_id = p_booking and t.started_at is not null), v_me = b.customer_id, v_ok;
end;
$fn$;
revoke all on function public.services_plan_code(uuid) from public, anon;
grant execute on function public.services_plan_code(uuid) to authenticated;

create or replace function public.services_plan_verify(p_booking uuid, p_code text)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path to 'public' as $fn$
declare v_me uuid := public.services_account_id(); b record; v_day date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if v_me is null then return query select false, 'sign_in_required'::text; return; end if;
  perform public.services_rate_guard('plan_verify', v_me::text, 30, 3600);
  select x.* into b from public.services_bookings x join public.services_workers w on w.id = x.worker_id and w.user_id = v_me where x.id = p_booking;
  if not found or b.status <> 'accepted' or not public.services_plan_trip_today(b.start_at, b.plan_repeat, b.plan_until) then
    return query select false, 'not_today'::text; return;
  end if;
  update public.services_plan_trips set started_at = coalesce(started_at, now())
   where booking_id = p_booking and trip_date = v_day and code = btrim(coalesce(p_code, ''));
  if not found then return query select false, 'wrong_code'::text; return; end if;
  return query select true, 'started'::text;
end;
$fn$;
revoke all on function public.services_plan_verify(uuid, text) from public, anon;
grant execute on function public.services_plan_verify(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select '235_1 done' as "235_1";
