-- 147 part 1: a four digit pickup code for each delivery job. The restaurant or
-- shop sees it and tells the rider when they arrive; the rider types it in to
-- confirm the pickup. A job can only be marked delivered after that.
alter table public.services_jobs add column if not exists pickup_code text;

create or replace function public.services_trg_job_code()
returns trigger
language plpgsql
as $fn$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.pickup_code := lpad((floor(random() * 10000))::int::text, 4, '0');
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_job_code_trg on public.services_jobs;
create trigger services_job_code_trg before update on public.services_jobs
  for each row execute function public.services_trg_job_code();

create or replace function public.services_job_code(p_job uuid)
returns table (code text, picked boolean, is_rider boolean)
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
           j.poster_id <> v_me
      from public.services_jobs j
      left join public.services_workers w on w.id = j.rider_work
     where j.id = p_job and j.status in ('accepted', 'picked_up', 'delivered')
       and (j.poster_id = v_me or w.user_id = v_me);
end;
$fn$;
revoke all on function public.services_job_code(uuid) from public, anon, authenticated;
grant execute on function public.services_job_code(uuid) to authenticated;
notify pgrst, 'reload schema';
select 'part 1 of 3 done' as "147_part1";
