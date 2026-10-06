-- 147 part 2: the rider confirms the pickup with the code, and a job can only
-- be marked delivered after a confirmed pickup. Replaces 117 part 9.
create or replace function public.services_job_verify(p_job uuid, p_code text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_n int := 0;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('jobcode', p_job::text || v_me::text, 8, 3600);
  update public.services_jobs j set status = 'picked_up'
   where j.id = p_job and j.status = 'accepted' and j.pickup_code = btrim(coalesce(p_code, ''))
     and exists (select 1 from public.services_workers w where w.id = j.rider_work and w.user_id = v_me);
  get diagnostics v_n = row_count;
  return query select v_n > 0, case when v_n > 0 then 'ok' else 'wrong_code' end::text;
end;
$fn$;
revoke all on function public.services_job_verify(uuid, text) from public, anon, authenticated;
grant execute on function public.services_job_verify(uuid, text) to authenticated;

create or replace function public.services_job_update(p_job uuid, p_action text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  j record;
  v_is_rider boolean;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  select x.* into j from public.services_jobs x where x.id = p_job for update;
  if not found then
    return query select false, 'not_found'::text;
    return;
  end if;
  v_is_rider := exists (select 1 from public.services_workers w where w.id = j.rider_work and w.user_id = v_me);
  if p_action = 'cancel' and j.poster_id = v_me and j.status in ('open', 'accepted') then
    update public.services_jobs set status = 'cancelled', done_at = now() where id = p_job;
  elsif p_action = 'delivered' and v_is_rider and j.status = 'picked_up' then
    update public.services_jobs set status = 'delivered', done_at = now() where id = p_job;
    update public.services_orders set status = 'delivered', updated_at = now()
     where job_id = p_job and status in ('accepted', 'ready');
  else
    return query select false, 'not_allowed'::text;
    return;
  end if;
  return query select true, p_action::text;
end;
$fn$;
revoke all on function public.services_job_update(uuid, text) from public, anon, authenticated;
grant execute on function public.services_job_update(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select 'part 2 of 3 done' as "147_part2";
