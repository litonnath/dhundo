-- 236_live_share.sql -- live location for both sides of every ride, delivery and booking while it is on. Each side
-- sends its own position; each can read the other side's (fresh within 5 minutes). Nothing else is exposed.
create table if not exists public.services_live_pos (
  kind text not null check (kind in ('ride', 'order', 'booking')),
  ref_id uuid not null,
  account_id uuid not null,
  lat double precision not null,
  lng double precision not null,
  at timestamptz not null default now(),
  primary key (kind, ref_id, account_id)
);
alter table public.services_live_pos enable row level security;
revoke all on public.services_live_pos from public, anon, authenticated;

create or replace function public.services_live_party(p_kind text, p_ref uuid, p_me uuid)
returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select case p_kind
    when 'ride' then exists (select 1 from public.services_rides r left join public.services_workers w on w.id = r.driver_work
      where r.id = p_ref and r.status = 'accepted' and (r.passenger_id = p_me or w.user_id = p_me))
    when 'order' then exists (select 1 from public.services_orders o join public.services_jobs j on j.id = o.job_id
      left join public.services_workers w on w.id = j.rider_work
      where o.id = p_ref and j.status in ('accepted', 'picked_up') and (o.customer_id = p_me or w.user_id = p_me))
    when 'booking' then exists (select 1 from public.services_bookings b join public.services_workers w on w.id = b.worker_id
      where b.id = p_ref and b.status = 'accepted' and (b.customer_id = p_me or w.user_id = p_me)
        and now() >= b.start_at - interval '3 hours'
        and now() <= coalesce(b.plan_end_at, b.start_at + make_interval(mins => coalesce(b.duration_mins, 60))) + interval '3 hours')
    else false end
$fn$;
revoke all on function public.services_live_party(text, uuid, uuid) from public, anon, authenticated;

create or replace function public.services_live_share(p_kind text, p_ref uuid, p_lat double precision, p_lng double precision)
returns boolean language plpgsql security definer set search_path to 'public' as $fn$
declare v_me uuid := public.services_account_id();
begin
  if v_me is null or p_lat is null or p_lng is null or not public.services_live_party(p_kind, p_ref, v_me) then return false; end if;
  insert into public.services_live_pos (kind, ref_id, account_id, lat, lng, at) values (p_kind, p_ref, v_me, p_lat, p_lng, now())
  on conflict (kind, ref_id, account_id) do update set lat = excluded.lat, lng = excluded.lng, at = now();
  return true;
end;
$fn$;
revoke all on function public.services_live_share(text, uuid, double precision, double precision) from public, anon;
grant execute on function public.services_live_share(text, uuid, double precision, double precision) to authenticated;

create or replace function public.services_live_peer(p_kind text, p_ref uuid)
returns table (lat double precision, lng double precision, at timestamptz)
language sql stable security definer set search_path to 'public' as $fn$
  select p.lat, p.lng, p.at from public.services_live_pos p
   where p.kind = p_kind and p.ref_id = p_ref and p.account_id <> public.services_account_id()
     and public.services_live_party(p_kind, p_ref, public.services_account_id()) and p.at > now() - interval '5 minutes';
$fn$;
revoke all on function public.services_live_peer(text, uuid) from public, anon;
grant execute on function public.services_live_peer(text, uuid) to authenticated;
notify pgrst, 'reload schema';
select '236 live share done' as "236";
