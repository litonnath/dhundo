-- ===========================================================================
-- 173_pickup_when_ready_1.sql -- a rider can collect an order only after the
-- restaurant or shop marks the food ready. job_code now also says whether the
-- food is ready (a job posted by hand has no order, so it is always ready).
-- Replaces services_job_code from 147 part 1. Run before 173_pickup_when_ready_2.
-- ===========================================================================
drop function if exists public.services_job_code(uuid);
create function public.services_job_code(p_job uuid)
returns table (code text, picked boolean, is_rider boolean, food_ready boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  update public.services_jobs j
     set pickup_code = lpad((floor(random() * 10000))::int::text, 4, '0')
   where j.id = p_job and j.status = 'accepted' and j.pickup_code is null;
  return query
    select case when j.poster_id = v_me then j.pickup_code else null end,
           j.status in ('picked_up', 'delivered'),
           j.poster_id <> v_me,
           not exists (select 1 from public.services_orders o where o.job_id = j.id and o.status <> 'ready')
      from public.services_jobs j
      left join public.services_workers w on w.id = j.rider_work
     where j.id = p_job and j.status in ('accepted', 'picked_up', 'delivered')
       and (j.poster_id = v_me or w.user_id = v_me);
end;
$fn$;
revoke all on function public.services_job_code(uuid) from public, anon, authenticated;
grant execute on function public.services_job_code(uuid) to authenticated;
notify pgrst, 'reload schema';
select '173 part 1 done' as "173_1";
