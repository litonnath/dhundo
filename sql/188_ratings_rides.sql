-- ===========================================================================
-- 188_ratings_rides.sql -- rides get the same two-way rating as deliveries: the
-- passenger rates the driver and the driver rates the passenger (stars, a few
-- words, or a complaint), once each, after a finished ride. Run after 187.
-- ===========================================================================
alter table public.services_delivery_ratings alter column order_id drop not null;
alter table public.services_delivery_ratings
  add column if not exists ride_id uuid references public.services_rides(id) on delete cascade;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'services_delivery_ratings_one_target') then
    alter table public.services_delivery_ratings add constraint services_delivery_ratings_one_target
      check ((order_id is not null) <> (ride_id is not null));
  end if;
end $$;
create unique index if not exists services_delivery_ratings_ride_once
  on public.services_delivery_ratings (ride_id, by_role) where ride_id is not null;

create or replace function public.services_ride_rate(p_ride uuid, p_stars int, p_comment text, p_complaint boolean)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  r record;
  v_driver uuid;
  v_role text;
  v_to uuid;
begin
  if v_me is null then return query select false, 'signin'::text; return; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then return query select false, 'bad_stars'::text; return; end if;
  select x.* into r from public.services_rides x where x.id = p_ride and x.status = 'done';
  if not found then return query select false, 'not_done'::text; return; end if;
  select w.user_id into v_driver from public.services_workers w where w.id = r.driver_work;
  if v_driver is null then return query select false, 'no_driver'::text; return; end if;
  if r.passenger_id = v_me then v_role := 'customer'; v_to := v_driver;
  elsif v_driver = v_me then v_role := 'rider'; v_to := r.passenger_id;
  else return query select false, 'not_allowed'::text; return; end if;
  insert into public.services_delivery_ratings (ride_id, by_role, from_account, to_account, stars, comment, complaint)
  values (r.id, v_role, v_me, v_to, p_stars, nullif(left(btrim(coalesce(p_comment, '')), 300), ''), coalesce(p_complaint, false));
  return query select true, 'saved'::text;
exception when unique_violation then
  return query select false, 'already'::text;
end;
$fn$;
revoke all on function public.services_ride_rate(uuid, int, text, boolean) from public, anon;
grant execute on function public.services_ride_rate(uuid, int, text, boolean) to authenticated;

create or replace function public.services_ride_rated(p_rides uuid[])
returns table (ride_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.ride_id from public.services_delivery_ratings r
   where r.from_account = public.services_account_id() and r.ride_id = any (coalesce(p_rides, '{}'::uuid[]));
$fn$;
revoke all on function public.services_ride_rated(uuid[]) from public, anon;
grant execute on function public.services_ride_rated(uuid[]) to authenticated;
notify pgrst, 'reload schema';
select '188 ratings rides done' as "188";
