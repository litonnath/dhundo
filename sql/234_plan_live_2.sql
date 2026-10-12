-- 234_plan_live_2.sql -- part 2 of 2: the customer and the rider of an accepted scheduled ride see each other's
-- live position (while the trip window is near), and the customer hears "Ride completed" when it is marked done.
create table if not exists public.services_plan_pos (
  booking_id uuid not null references public.services_bookings(id) on delete cascade,
  account_id uuid not null,
  lat double precision not null,
  lng double precision not null,
  at timestamptz not null default now(),
  primary key (booking_id, account_id)
);
alter table public.services_plan_pos enable row level security;
revoke all on public.services_plan_pos from public, anon, authenticated;

-- Who may share: the customer or the driver of an accepted booking, from 3 hours before the first trip to 3 hours after the last.
create or replace function public.services_plan_live_set(p_booking uuid, p_lat double precision, p_lng double precision)
returns boolean language plpgsql security definer set search_path to 'public' as $fn$
declare v_me uuid := public.services_account_id(); b record;
begin
  if v_me is null or p_lat is null or p_lng is null then return false; end if;
  select x.*, w.user_id as drv into b from public.services_bookings x join public.services_workers w on w.id = x.worker_id where x.id = p_booking;
  if not found or v_me not in (b.customer_id, b.drv) or b.status <> 'accepted'
     or now() < b.start_at - interval '3 hours'
     or now() > coalesce(b.plan_end_at, b.start_at + make_interval(mins => coalesce(b.duration_mins, 60))) + interval '3 hours' then
    return false;
  end if;
  insert into public.services_plan_pos (booking_id, account_id, lat, lng, at) values (p_booking, v_me, p_lat, p_lng, now())
  on conflict (booking_id, account_id) do update set lat = excluded.lat, lng = excluded.lng, at = now();
  return true;
end;
$fn$;
revoke all on function public.services_plan_live_set(uuid, double precision, double precision) from public, anon;
grant execute on function public.services_plan_live_set(uuid, double precision, double precision) to authenticated;

create or replace function public.services_plan_live_get(p_booking uuid)
returns table (kind text, lat double precision, lng double precision, at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $fn$
declare v_me uuid := public.services_account_id(); b record;
begin
  select x.*, w.user_id as drv into b from public.services_bookings x join public.services_workers w on w.id = x.worker_id where x.id = p_booking;
  if v_me is null or not found or v_me not in (b.customer_id, b.drv) then return; end if;
  if b.pick_lat is not null then return query select 'pick'::text, b.pick_lat, b.pick_lng, null::timestamptz; end if;
  if b.drop_lat is not null then return query select 'drop'::text, b.drop_lat, b.drop_lng, null::timestamptz; end if;
  return query select case when p.account_id = v_me then 'me' else 'other' end::text, p.lat, p.lng, p.at
    from public.services_plan_pos p where p.booking_id = p_booking and p.at > now() - interval '10 minutes';
end;
$fn$;
revoke all on function public.services_plan_live_get(uuid) from public, anon;
grant execute on function public.services_plan_live_get(uuid) to authenticated;

create or replace function public.services_booking_done_notify()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  perform public.services_notify(new.customer_id, case when coalesce(new.note, '') like 'Scheduled rides.%' then 'plan_done' else 'booking_done' end, null);
  return new;
end;
$fn$;
drop trigger if exists services_booking_done_trg on public.services_bookings;
create trigger services_booking_done_trg after update of status on public.services_bookings
  for each row when (new.status = 'completed' and old.status is distinct from new.status) execute function public.services_booking_done_notify();
notify pgrst, 'reload schema';
select '234 plan live part 2 done' as "234_2";
