-- ===========================================================================
-- 173_pickup_when_ready_2.sql -- the pickup code only works once the food is
-- marked ready. Replaces services_job_verify from 147 part 2. Run after part 1.
-- ===========================================================================
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
  if exists (select 1 from public.services_orders o where o.job_id = p_job and o.status <> 'ready') then
    return query select false, 'not_ready'::text;
    return;
  end if;
  update public.services_jobs j set status = 'picked_up'
   where j.id = p_job and j.status = 'accepted' and j.pickup_code = btrim(coalesce(p_code, ''))
     and exists (select 1 from public.services_workers w where w.id = j.rider_work and w.user_id = v_me);
  get diagnostics v_n = row_count;
  return query select v_n > 0, case when v_n > 0 then 'ok' else 'wrong_code' end::text;
end;
$fn$;
revoke all on function public.services_job_verify(uuid, text) from public, anon, authenticated;
grant execute on function public.services_job_verify(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select '173 part 2 done' as "173_2";
