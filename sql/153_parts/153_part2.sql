-- 153_part2.sql -- reading ratings. Run after part 1.
drop function if exists public.services_rating_summary(uuid[]);
create function public.services_rating_summary(p_workers uuid[])
returns table (worker_id uuid, avg_stars numeric, n int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.worker_id, round(avg(r.stars)::numeric, 1), count(*)::int
    from public.services_reviews r
   where r.worker_id = any (p_workers)
   group by r.worker_id;
$fn$;
revoke all on function public.services_rating_summary(uuid[]) from public;
grant execute on function public.services_rating_summary(uuid[]) to anon, authenticated;

drop function if exists public.services_reviews_for(uuid, int);
create function public.services_reviews_for(p_worker uuid, p_limit int default 10)
returns table (stars int, comment text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.stars, r.comment, r.created_at
    from public.services_reviews r
   where r.worker_id = p_worker and not r.complaint and r.comment is not null
   order by r.created_at desc
   limit greatest(1, least(coalesce(p_limit, 10), 30));
$fn$;
revoke all on function public.services_reviews_for(uuid, int) from public;
grant execute on function public.services_reviews_for(uuid, int) to anon, authenticated;

drop function if exists public.services_my_reviews(int);
create function public.services_my_reviews(p_limit int default 20)
returns table (stars int, comment text, complaint boolean, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.stars, r.comment, r.complaint, r.created_at
    from public.services_reviews r
    join public.services_workers w on w.id = r.worker_id
   where w.user_id = public.services_account_id()
   order by r.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 50));
$fn$;
revoke all on function public.services_my_reviews(int) from public, anon, authenticated;
grant execute on function public.services_my_reviews(int) to authenticated;
notify pgrst, 'reload schema';
select 'part 2 done' as "153_part2";
