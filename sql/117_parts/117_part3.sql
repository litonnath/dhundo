-- ===========================================================================
-- 117_part3.sql -- the owner reads and sets hours, delivery time, and whether
-- to use Dhundo riders for delivery orders.
-- ===========================================================================
create or replace function public.services_my_store()
returns table (accepting boolean, open_time time, close_time time, delivery_mins int, auto_rider boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.accepting_orders, w.open_time, w.close_time, w.delivery_mins, w.auto_rider
    from public.services_workers w
   where w.user_id = public.services_account_id() and w.status = 'approved'
   limit 1;
$fn$;
revoke all on function public.services_my_store() from public, anon, authenticated;
grant execute on function public.services_my_store() to authenticated;

create or replace function public.services_set_store(
  p_open time, p_close time, p_mins int, p_auto_rider boolean)
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_n int;
begin
  update public.services_workers
     set open_time = p_open, close_time = p_close,
         delivery_mins = case when p_mins between 5 and 720 then p_mins end,
         auto_rider = coalesce(p_auto_rider, true)
   where user_id = public.services_account_id() and status = 'approved';
  get diagnostics v_n = row_count;
  return query select v_n > 0;
end;
$fn$;
revoke all on function public.services_set_store(time, time, int, boolean) from public, anon, authenticated;
grant execute on function public.services_set_store(time, time, int, boolean) to authenticated;

select 'part 3 of 9 done' as "117_part3";
