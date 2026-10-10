-- ===========================================================================
-- 171_realert_returned_job.sql -- when a rider gives a job back, the other
-- online delivery riders near the shop are alerted again (the rider who gave
-- it back is not). Replaces services_job_rider_cancel from 170. Run after 170.
-- ===========================================================================
create or replace function public.services_job_rider_cancel(p_job uuid, p_reason text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_why text := left(btrim(coalesce(p_reason, '')), 200);
  j record;
  p record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  if char_length(v_why) < 2 then
    return query select false, 'reason_needed'::text;
    return;
  end if;
  select x.* into j from public.services_jobs x where x.id = p_job for update;
  if not found or j.status <> 'accepted'
     or not exists (select 1 from public.services_workers w where w.id = j.rider_work and w.user_id = v_me) then
    return query select false, 'no_change'::text;
    return;
  end if;
  update public.services_jobs
     set status = 'open', rider_work = null, accepted_at = null,
         expires_at = now() + interval '30 minutes'
   where id = j.id;
  insert into public.services_cancellations (order_id, job_id, by_role, account_id, reason)
  values ((select o.id from public.services_orders o where o.job_id = j.id limit 1), j.id, 'rider', v_me, v_why);
  select w.lat, nullif(btrim(w.pincode), '') as pin, w.city_id into p
    from public.services_workers w where w.id = j.poster_work;
  perform public.services_notify(r.user_id, 'job_new', null)
    from (select w.user_id
            from public.services_workers w
            join public.services_presence pr on pr.worker_id = w.id
           where w.status = 'approved' and w.serves_delivery and w.user_id <> v_me
             and public.services_is_delivery_trade(w.trade_slug)
             and pr.online_until > now()
             and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
             and (case when p.lat is not null
                       then public.services_km(pr.lat, pr.lng, p.lat, p.lng) <= 10
                       else (p.pin is not null and nullif(btrim(w.pincode), '') = p.pin)
                         or (p.city_id is not null and w.city_id = p.city_id) end)
           limit 40) r;
  return query select true, 'released'::text;
end;
$fn$;
revoke all on function public.services_job_rider_cancel(uuid, text) from public, anon;
grant execute on function public.services_job_rider_cancel(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select '171 realert returned job done' as "171";
