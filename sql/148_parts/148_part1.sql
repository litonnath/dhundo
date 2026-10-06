-- 148 part 1: a four digit delivery code for the customer of an order. The
-- customer sees it and tells the rider at the door; the rider types it in to
-- finish the delivery. That shows the rider has met the right customer. Jobs
-- that do not belong to an order (posted by hand) are finished with the
-- Delivered button as before. Needs 147.
alter table public.services_orders add column if not exists delivery_code text;

create or replace function public.services_job_delivery_code(p_job uuid)
returns table (code text, needs_code boolean, delivered boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  update public.services_orders o
     set delivery_code = lpad((floor(random() * 10000))::int::text, 4, '0')
   where o.job_id = p_job and o.delivery_code is null;
  return query
    select case when o.customer_id = v_me then o.delivery_code else null end,
           true, j.status = 'delivered'
      from public.services_jobs j
      join public.services_orders o on o.job_id = j.id
      left join public.services_workers w on w.id = j.rider_work
     where j.id = p_job and (o.customer_id = v_me or w.user_id = v_me);
  if not found then
    return query
      select null::text, false, j.status = 'delivered'
        from public.services_jobs j
        join public.services_workers w on w.id = j.rider_work and w.user_id = v_me
       where j.id = p_job;
  end if;
end;
$fn$;
revoke all on function public.services_job_delivery_code(uuid) from public, anon, authenticated;
grant execute on function public.services_job_delivery_code(uuid) to authenticated;
notify pgrst, 'reload schema';
select 'part 1 of 2 done' as "148_part1";
