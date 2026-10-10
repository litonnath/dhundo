-- ===========================================================================
-- 195_job_accept_far.sql -- a rider may accept a delivery job inside the job's
-- search circle, which grows from 10 km to 30 km (fixing 142's fixed 10 km, which
-- let far riders see a job but never take it). When the rider is more than 10 km
-- from the restaurant, every km beyond 10 is added at the rate card's per-km
-- rate to the rider's fee and to the delivery partner fee on the order, so the
-- far ride is paid for. Replaces services_job_accept. Run after 179_widen_radius_1.sql.
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
  v_extra int := 0;
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
  if v_d is not null and v_d > 10 then
    v_extra := ceil((v_d - 10) * coalesce((select c.per_km_rupees from public.services_rate_card c where c.key = 'delivery_food'), 0))::int * 100;
    if v_extra > 0 then
      update public.services_jobs set fee_paise = coalesce(fee_paise, 0) + v_extra where id = p_job;
      update public.services_orders set delivery_fee_paise = delivery_fee_paise + v_extra where job_id = p_job;
    end if;
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
select '195 job accept far done' as "195";
