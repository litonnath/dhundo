-- ===========================================================================
-- 117_part2.sql -- is this place open now. Times are Indian Standard Time.
-- No hours set means open whenever the owner is taking orders.
-- ===========================================================================
create or replace function public.services_is_open_now(p_open time, p_close time, p_accepting boolean)
returns boolean
language sql
stable
set search_path to 'public'
as $fn$
  select coalesce(p_accepting, true) and (
    p_open is null or p_close is null
    or case when p_open <= p_close
            then (now() at time zone 'Asia/Kolkata')::time between p_open and p_close
            else (now() at time zone 'Asia/Kolkata')::time >= p_open
              or (now() at time zone 'Asia/Kolkata')::time <= p_close end);
$fn$;

create or replace function public.services_store_infos(p_ids uuid[])
returns table (id uuid, open_now boolean, open_time time, close_time time, delivery_mins int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.id, public.services_is_open_now(w.open_time, w.close_time, w.accepting_orders),
         w.open_time, w.close_time, w.delivery_mins
    from public.services_workers w
   where w.id = any (p_ids) and w.status = 'approved';
$fn$;
revoke all on function public.services_store_infos(uuid[]) from public;
grant execute on function public.services_store_infos(uuid[]) to anon, authenticated;

select 'part 2 of 9 done' as "117_part2";
