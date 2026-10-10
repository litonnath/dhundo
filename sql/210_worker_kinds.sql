-- 210: is each of these listings a restaurant / food place (true) or a shop
-- (false)? Lets order screens say "restaurant" or "shop" correctly.
create or replace function public.services_workers_kinds(p_ids uuid[])
returns table (id uuid, is_eat boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.id, (t.group_name = 'Eat & Stay')
    from public.services_workers w
    left join public.services_trades t on t.slug = w.trade_slug
   where w.id = any (p_ids);
$fn$;
revoke all on function public.services_workers_kinds(uuid[]) from public;
grant execute on function public.services_workers_kinds(uuid[]) to anon, authenticated;

-- The same, for delivery jobs: is the pickup place a restaurant or a shop?
create or replace function public.services_job_kinds(p_ids uuid[])
returns table (id uuid, is_eat boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select j.id, (t.group_name = 'Eat & Stay')
    from public.services_jobs j
    join public.services_workers w on w.id = j.poster_work
    left join public.services_trades t on t.slug = w.trade_slug
   where j.id = any (p_ids);
$fn$;
revoke all on function public.services_job_kinds(uuid[]) from public, anon;
grant execute on function public.services_job_kinds(uuid[]) to authenticated;
notify pgrst, 'reload schema';
select '210 worker kinds done' as "210";
