-- 80 part 3 of 4: a worker asks whether they are online.

drop function if exists public.services_my_availability();

create or replace function public.services_my_availability()
returns table (online boolean, online_until timestamptz, seen_at timestamptz, visible boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select (pr.worker_id is not null and pr.online_until > now()),
         pr.online_until, pr.seen_at,
         (w.status = 'approved' and w.available)
    from public.services_workers w
    left join public.services_presence pr on pr.worker_id = w.id
   where w.user_id = public.services_account_id()
   limit 1;
$$;

revoke all on function public.services_my_availability() from public, anon, authenticated;
grant execute on function public.services_my_availability() to authenticated;

select 'part 3 done' as result;
