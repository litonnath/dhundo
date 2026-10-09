-- ===========================================================================
-- 167_admin_console_2.sql -- admin-only: rides list and people (customers and
-- partners) search for the admin console. Run after 167_admin_console_1.sql.
-- ===========================================================================
create or replace function public.services_admin_rides(p_status text default null, p_limit int default 100)
returns table (id uuid, created_at timestamptz, status text, vehicle text,
               fare_paise int, pick_text text, drop_text text,
               passenger text, driver text)
language plpgsql stable security definer set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  return query
    select r.id, r.created_at, r.status::text, r.vehicle::text, r.fare_paise,
           r.pick_text::text, r.drop_text::text, p.full_name::text,
           coalesce(nullif(btrim(d.business_name), ''), d.full_name)::text
      from public.services_rides r
      join public.services_signups p on p.id = r.passenger_id
      left join public.services_workers d on d.id = r.driver_work
     where p_status is null or r.status = p_status
     order by r.created_at desc
     limit least(greatest(coalesce(p_limit, 100), 1), 300);
end;
$fn$;
revoke all on function public.services_admin_rides(text, int) from public, anon;
grant execute on function public.services_admin_rides(text, int) to authenticated;

create or replace function public.services_admin_people(p_q text default null, p_limit int default 100)
returns table (id uuid, full_name text, phone text, joined timestamptz,
               listings bigint, orders bigint, rides bigint)
language plpgsql stable security definer set search_path to 'public'
as $fn$
declare v_q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  return query
    select s.id, s.full_name::text, s.phone::text,
           nullif(to_jsonb(s)->>'created_at', '')::timestamptz,
           (select count(*) from public.services_workers w where w.user_id = s.id),
           (select count(*) from public.services_orders o where o.customer_id = s.id),
           (select count(*) from public.services_rides r where r.passenger_id = s.id)
      from public.services_signups s
     where v_q is null or s.full_name ilike '%' || v_q || '%' or s.phone::text like '%' || v_q || '%'
     order by nullif(to_jsonb(s)->>'created_at', '')::timestamptz desc nulls last
     limit least(greatest(coalesce(p_limit, 100), 1), 300);
end;
$fn$;
revoke all on function public.services_admin_people(text, int) from public, anon;
grant execute on function public.services_admin_people(text, int) to authenticated;
notify pgrst, 'reload schema';
select '167 part 2 done' as "167_2";
