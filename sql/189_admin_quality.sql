-- ===========================================================================
-- 189_admin_quality.sql -- for the admin: who is rated badly, and every rating
-- and complaint. A partner is flagged when it has 3 or more ratings averaging
-- under 3.5, or 2 or more complaints. Ratings come from deliveries, rides and
-- shop / restaurant reviews. Admin only. Run after 187 and 188.
-- ===========================================================================
create or replace function public.services_admin_quality()
returns table (worker_id uuid, name text, trade text, phone text, status text,
               avg_stars numeric, ratings bigint, complaints bigint, flagged boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  return query
    with s as (
      select w.id as wid, r.stars, r.complaint
        from public.services_workers w
        join public.services_delivery_ratings r on r.to_account = w.user_id and r.by_role = 'customer'
      union all
      select rv.worker_id, rv.stars, rv.complaint from public.services_reviews rv
    )
    select w.id, coalesce(nullif(btrim(w.business_name), ''), w.full_name)::text, t.name_en::text,
           w.phone::text, w.status::text,
           round(avg(s.stars)::numeric, 2), count(*), count(*) filter (where s.complaint),
           ((count(*) >= 3 and avg(s.stars) < 3.5) or count(*) filter (where s.complaint) >= 2)
      from s
      join public.services_workers w on w.id = s.wid
      left join public.services_trades t on t.slug = w.trade_slug
     group by w.id, w.business_name, w.full_name, t.name_en, w.phone, w.status
     order by 9 desc, 6 asc
     limit 100;
end;
$fn$;
revoke all on function public.services_admin_quality() from public, anon;
grant execute on function public.services_admin_quality() to authenticated;

create or replace function public.services_admin_ratings(p_complaints_only boolean default false)
returns table (kind text, by_role text, from_name text, to_name text,
               stars int, comment text, complaint boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  return query
    select * from (
      select case when r.ride_id is not null then 'ride' else 'delivery' end::text,
             r.by_role::text, f.full_name::text, tt.full_name::text, r.stars, r.comment::text, r.complaint, r.created_at
        from public.services_delivery_ratings r
        join public.services_signups f on f.id = r.from_account
        join public.services_signups tt on tt.id = r.to_account
      union all
      select 'shop'::text, 'customer'::text, f.full_name::text,
             coalesce(nullif(btrim(w.business_name), ''), w.full_name)::text, rv.stars, rv.comment::text, rv.complaint, rv.created_at
        from public.services_reviews rv
        join public.services_signups f on f.id = rv.reviewer_id
        join public.services_workers w on w.id = rv.worker_id
    ) q
     where not coalesce(p_complaints_only, false) or q.complaint
     order by q.created_at desc
     limit 150;
end;
$fn$;
revoke all on function public.services_admin_ratings(boolean) from public, anon;
grant execute on function public.services_admin_ratings(boolean) to authenticated;
notify pgrst, 'reload schema';
select '189 admin quality done' as "189";
