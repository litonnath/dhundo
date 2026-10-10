-- ===========================================================================
-- 186_rider_points.sql -- when the restaurant has no map position, or the order
-- has no pinned drop point, the rider who holds the delivery can save the spot
-- from his own phone while he stands there ("pickup" at the restaurant, "drop"
-- at the customer's door). It is kept on the job, only for that delivery, and
-- only where the real position is missing; it never changes the shop or order.
-- Run before 174_rider_calls_customer.sql and 184_order_rider_position.sql
-- (both read these columns).
-- ===========================================================================
alter table public.services_jobs
  add column if not exists pickup_lat double precision check (pickup_lat is null or pickup_lat between 6 and 38),
  add column if not exists pickup_lng double precision check (pickup_lng is null or pickup_lng between 67 and 98),
  add column if not exists drop_lat double precision check (drop_lat is null or drop_lat between 6 and 38),
  add column if not exists drop_lng double precision check (drop_lng is null or drop_lng between 67 and 98);

create or replace function public.services_job_set_point(p_job uuid, p_kind text, p_lat double precision, p_lng double precision)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  j record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  if p_kind not in ('shop', 'drop') or p_lat is null or p_lng is null
     or p_lat not between 6 and 38 or p_lng not between 67 and 98 then
    return query select false, 'bad_input'::text;
    return;
  end if;
  perform public.services_rate_guard('job_point', v_me::text, 30, 3600);
  select x.* into j from public.services_jobs x
   where x.id = p_job and x.status in ('accepted', 'picked_up')
     and exists (select 1 from public.services_workers w where w.id = x.rider_work and w.user_id = v_me)
   for update;
  if not found then
    return query select false, 'not_allowed'::text;
    return;
  end if;
  if p_kind = 'shop' and not exists (select 1 from public.services_workers s where s.id = j.poster_work and s.lat is null) then
    return query select false, 'already_known'::text;
    return;
  end if;
  if p_kind = 'drop' and exists (select 1 from public.services_orders o where o.job_id = j.id and o.lat is not null) then
    return query select false, 'already_known'::text;
    return;
  end if;
  if p_kind = 'shop' then
    update public.services_jobs set pickup_lat = p_lat, pickup_lng = p_lng where id = j.id;
  else
    update public.services_jobs set drop_lat = p_lat, drop_lng = p_lng where id = j.id;
  end if;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_job_set_point(uuid, text, double precision, double precision) from public, anon;
grant execute on function public.services_job_set_point(uuid, text, double precision, double precision) to authenticated;
notify pgrst, 'reload schema';
select '186 rider points done' as "186";
