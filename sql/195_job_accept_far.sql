-- ===========================================================================
-- 195_job_accept_far.sql -- accepting a delivery job. A rider may accept inside the
-- job's search circle, which grows from 10 km to 30 km. On acceptance the delivery
-- partner fee is worked out exactly from the rider's real distance to the
-- restaurant (see 182): the rider's fee and the order's fee both become that
-- amount, never above the high end the customer was shown. If it is lower than
-- the estimate the customer pays (or is refunded) the difference.
-- Replaces services_job_accept. Run after 179_widen_radius_1.sql, 182_delivery_quote.sql
-- and 196_fee_range_1.sql.
-- ===========================================================================
create or replace function public.services_job_accept(p_job uuid)
returns table (ok boolean, reason text, shop text, phone text, lat double precision, lng double precision)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_rider uuid;
  v_poster uuid;
  v_d double precision;
  o record;
  v_drop numeric;
  v_fee int;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text, null::text, null::text, null::double precision, null::double precision;
    return;
  end if;
  perform public.services_rate_guard('job_accept', v_me::text, 60, 3600);
  select w.id into v_rider
    from public.services_workers w
    join public.services_presence pr on pr.worker_id = w.id
   where w.user_id = v_me and w.status = 'approved' and pr.online_until > now()
     and public.services_is_delivery_trade(w.trade_slug)
   limit 1;
  if v_rider is null then
    return query select false, 'not_online'::text, null::text, null::text, null::double precision, null::double precision;
    return;
  end if;
  update public.services_jobs j
     set status = 'accepted', rider_work = v_rider, accepted_at = now()
   where j.id = p_job and j.status = 'open' and j.expires_at > now()
     and j.poster_id <> v_me
     and exists (select 1 from public.services_presence pr, public.services_workers pw
                  where pr.worker_id = v_rider and pw.id = j.poster_work and pw.lat is not null
                    and public.services_km(pr.lat, pr.lng, pw.lat, pw.lng)
                        <= least(10 + 5 * floor(extract(epoch from (now() - j.created_at)) / 180), 30))
   returning j.poster_work into v_poster;
  if v_poster is null then
    return query select false, 'taken'::text, null::text, null::text, null::double precision, null::double precision;
    return;
  end if;
  select public.services_km(pr.lat, pr.lng, pw.lat, pw.lng) into v_d
    from public.services_presence pr, public.services_workers pw
   where pr.worker_id = v_rider and pw.id = v_poster;
  select x.* into o from public.services_orders x where x.job_id = p_job and x.mode = 'delivery';
  if found and v_d is not null then
    select case when o.lat is null or w.lat is null then 3.0
                else round((1.3 * public.services_km(w.lat, w.lng, o.lat, o.lng))::numeric, 1) end into v_drop
      from public.services_workers w where w.id = v_poster;
    v_fee := public.services_fee_for_km(v_poster, (coalesce(v_drop, 3.0) + greatest(0, 1.3 * v_d - 2))::numeric);
    if o.delivery_fee_max_paise > 0 then v_fee := least(v_fee, o.delivery_fee_max_paise); end if;
    update public.services_jobs set fee_paise = v_fee where id = p_job;
    update public.services_orders set delivery_fee_paise = v_fee where id = o.id;
  end if;
  return query
    select true, 'accepted'::text, coalesce(nullif(btrim(p.business_name), ''), p.full_name)::text,
           p.phone::text, p.lat, p.lng
      from public.services_workers p where p.id = v_poster;
end;
$fn$;
revoke all on function public.services_job_accept(uuid) from public, anon, authenticated;
grant execute on function public.services_job_accept(uuid) to authenticated;
notify pgrst, 'reload schema';
select '195 job accept done' as "195";
