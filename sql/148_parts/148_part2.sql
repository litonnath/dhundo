-- 148 part 2: the rider finishes a delivery by typing the customer code.
create or replace function public.services_job_deliver(p_job uuid, p_code text)
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
  perform public.services_rate_guard('jobdeliver', p_job::text || v_me::text, 8, 3600);
  if not exists (select 1 from public.services_orders o
                  where o.job_id = p_job and o.delivery_code = btrim(coalesce(p_code, ''))
                    and exists (select 1 from public.services_jobs j
                                  join public.services_workers w on w.id = j.rider_work
                                 where j.id = p_job and j.status = 'picked_up' and w.user_id = v_me)) then
    return query select false, 'wrong_code'::text;
    return;
  end if;
  update public.services_jobs set status = 'delivered', done_at = now() where id = p_job and status = 'picked_up';
  get diagnostics v_n = row_count;
  update public.services_orders set status = 'delivered', updated_at = now()
   where job_id = p_job and status in ('accepted', 'ready');
  return query select v_n > 0, case when v_n > 0 then 'ok' else 'no_change' end::text;
end;
$fn$;
revoke all on function public.services_job_deliver(uuid, text) from public, anon, authenticated;
grant execute on function public.services_job_deliver(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select 'part 2 of 2 done' as "148_part2";
