-- ===========================================================================
-- 120_part4.sql -- the rider reads and sets their own service settings.
-- ===========================================================================
create or replace function public.services_my_rider()
returns table (per_km_rupees int, serves_rides boolean, serves_delivery boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.per_km_rupees, w.serves_rides, w.serves_delivery
    from public.services_workers w
   where w.user_id = public.services_account_id() and w.status in ('approved', 'pending')
   limit 1;
$fn$;
revoke all on function public.services_my_rider() from public, anon, authenticated;
grant execute on function public.services_my_rider() to authenticated;

create or replace function public.services_set_rider(p_per_km int, p_rides boolean, p_delivery boolean)
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_n int;
begin
  update public.services_workers
     set per_km_rupees = case when p_per_km between 0 and 500 then p_per_km end,
         serves_rides = coalesce(p_rides, true), serves_delivery = coalesce(p_delivery, true)
   where user_id = public.services_account_id() and status in ('approved', 'pending');
  get diagnostics v_n = row_count;
  return query select v_n > 0;
end;
$fn$;
revoke all on function public.services_set_rider(int, boolean, boolean) from public, anon, authenticated;
grant execute on function public.services_set_rider(int, boolean, boolean) to authenticated;

select 'part 4 of 8 done' as "120_part4";
