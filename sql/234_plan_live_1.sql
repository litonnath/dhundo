-- 234_plan_live_1.sql -- scheduled rides keep the pickup and destination points (1 of 2).
alter table public.services_bookings add column if not exists pick_lat double precision, add column if not exists pick_lng double precision,
  add column if not exists drop_lat double precision, add column if not exists drop_lng double precision;
drop function if exists public.services_ride_plan_request(uuid, timestamptz, int, text, date, text, text, numeric, text);
create or replace function public.services_ride_plan_request(
  p_worker uuid, p_start timestamptz, p_minutes int, p_repeat text, p_until date,
  p_pick text, p_drop text, p_km numeric, p_note text default null,
  p_pick_lat double precision default null, p_pick_lng double precision default null,
  p_drop_lat double precision default null, p_drop_lng double precision default null)
returns table (ok boolean, reason text, trips int, price_paise int)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_slug text; v_key text; c record;
  v_day date := (p_start at time zone 'Asia/Kolkata')::date;
  v_trips int; v_fare int; v_step interval; v_last timestamptz; v_note text;
begin
  if v_me is null then return query select false, 'sign_in_required'::text, 0, 0; return; end if;
  perform public.services_rate_guard('booking', v_me::text, 20, 86400);
  if p_start is null or p_minutes is null or p_minutes < 5 or p_minutes > 600 or p_repeat not in ('once', 'daily', 'weekly')
     or p_start < now() - interval '10 minutes' or p_start > now() + interval '365 days'
     or p_km is null or p_km < 0.1 or p_km > 300 or length(btrim(coalesce(p_pick, ''))) < 3 or length(btrim(coalesce(p_drop, ''))) < 3
     or (p_repeat <> 'once' and (p_until is null or p_until < v_day or p_until > v_day + 180)) then
    return query select false, 'bad_input'::text, 0, 0; return;
  end if;
  select w.trade_slug into v_slug from public.services_workers w
    join public.services_trades t on t.slug = w.trade_slug and t.group_name = 'Drivers'
   where w.id = p_worker and w.status = 'approved' and w.user_id <> v_me;
  if v_slug is null or v_slug ~* 'deliver' then return query select false, 'not_found'::text, 0, 0; return; end if;
  v_key := case when v_slug ~* '(bike|moto|scooter)' then 'ride_bike' when v_slug ~* '(auto|rick|toto)' then 'ride_auto'
                when v_slug ~* '(taxi|cab|(^|-)car($|-))' then 'ride_taxi' end;
  select * into c from public.services_rate_card where key = v_key;
  if v_key is null or not found then return query select false, 'not_found'::text, 0, 0; return; end if;
  if exists (select 1 from public.services_bookings b where b.customer_id = v_me and b.worker_id = p_worker
              and (b.status = 'requested' or (b.status = 'accepted' and coalesce(b.plan_end_at, b.start_at + make_interval(mins => coalesce(b.duration_mins, 0))) > now()))) then
    return query select false, 'already_open'::text, 0, 0; return;
  end if;
  v_trips := case p_repeat when 'once' then 1 when 'daily' then (p_until - v_day) + 1 else ((p_until - v_day) / 7) + 1 end;
  v_step := case p_repeat when 'weekly' then interval '7 days' else interval '1 day' end;
  v_last := p_start + (v_trips - 1) * v_step;
  v_fare := round(greatest(c.min_rupees, c.base_rupees + c.per_km_rupees * p_km))::int;
  v_note := 'Scheduled rides. From: ' || left(btrim(p_pick), 90) || ' To: ' || left(btrim(p_drop), 90) || '. Pickup '
    || to_char(p_start at time zone 'Asia/Kolkata', 'HH12:MI AM') || ', drop by '
    || to_char((p_start + make_interval(mins => p_minutes)) at time zone 'Asia/Kolkata', 'HH12:MI AM') || '. '
    || case p_repeat when 'once' then 'One trip' when 'daily' then 'Every day until ' || to_char(p_until, 'DD Mon') else 'Every week until ' || to_char(p_until, 'DD Mon') end
    || '. ' || v_trips || ' trip(s) x Rs ' || v_fare || ' = Rs ' || (v_trips * v_fare) || '.'
    || case when length(btrim(coalesce(p_note, ''))) > 0 then ' ' || left(btrim(p_note), 120) else '' end;
  insert into public.services_bookings (customer_id, worker_id, period, start_on, start_at, duration_mins, note, price_paise, plan_repeat, plan_until, plan_end_at, pick_lat, pick_lng, drop_lat, drop_lng)
  values (v_me, p_worker, 'custom', v_day, p_start, p_minutes, left(v_note, 600), v_trips * v_fare * 100, p_repeat,
          case when p_repeat = 'once' then null else p_until end, v_last + make_interval(mins => p_minutes),
          p_pick_lat, p_pick_lng, p_drop_lat, p_drop_lng);
  return query select true, 'requested'::text, v_trips, v_trips * v_fare * 100;
end;
$fn$;
revoke all on function public.services_ride_plan_request(uuid, timestamptz, int, text, date, text, text, numeric, text, double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.services_ride_plan_request(uuid, timestamptz, int, text, date, text, text, numeric, text, double precision, double precision, double precision, double precision) to authenticated;
notify pgrst, 'reload schema';
select '234_1 done' as "234_1";
