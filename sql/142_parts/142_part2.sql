-- 142 part 2: only a delivery rider can accept a delivery job. Replaces 113 part 3.
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
                    and public.services_km(pr.lat, pr.lng, pw.lat, pw.lng) <= 10)
   returning j.poster_work into v_poster;
  if v_poster is null then
    return query select false, 'taken'::text, null::text, null::text, null::double precision, null::double precision;
    return;
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
select 'part 2 of 2 done' as "142_part2";
