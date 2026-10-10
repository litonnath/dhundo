-- ===========================================================================
-- 181_no_rider_fallback_2.sql -- part 2: release_due also retries unclaimed jobs, and a
-- customer or shop can turn a no-rider delivery into a pickup. Run after part 1.
-- ===========================================================================
create or replace function public.services_orders_release_due()
returns int
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select x.id from public.services_orders x
     where x.mode = 'delivery' and x.status = 'accepted' and x.job_id is null
       and x.rider_after is not null and x.rider_after <= now()
     order by x.rider_after limit 20
  loop
    if public.services_order_post_job(r.id) is not null then v_n := v_n + 1; end if;
  end loop;
  perform public.services_jobs_retry();
  perform public.services_jobs_widen();
  return v_n;
end;
$fn$;
revoke all on function public.services_orders_release_due() from public, anon;
grant execute on function public.services_orders_release_due() to authenticated;

create or replace function public.services_order_to_pickup(p_order uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  o record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  select x.* into o from public.services_orders x where x.id = p_order and x.mode = 'delivery'
     and x.status in ('accepted', 'ready') for update;
  if not found or not (o.customer_id = v_me or exists (
       select 1 from public.services_workers w where w.id = o.worker_id and w.user_id = v_me)) then
    return query select false, 'not_allowed'::text;
    return;
  end if;
  if o.job_id is not null and not exists (
       select 1 from public.services_jobs j where j.id = o.job_id and j.status in ('open', 'expired', 'cancelled')) then
    return query select false, 'rider_has_it'::text;
    return;
  end if;
  update public.services_jobs set status = 'cancelled', done_at = now()
   where id = o.job_id and status = 'open';
  update public.services_orders set mode = 'pickup', delivery_fee_paise = 0, job_id = null, updated_at = now()
   where id = o.id;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_order_to_pickup(uuid) from public, anon;
grant execute on function public.services_order_to_pickup(uuid) to authenticated;
notify pgrst, 'reload schema';
select '181 part 2 done' as "181_2";
