-- 138: ride history for the passenger and for the driver. Finished, cancelled
-- and expired rides of the last 90 days, newest first.
create or replace function public.services_ride_history()
returns table (id uuid, role text, status text, pick_text text, drop_text text,
               fare_paise int, created_at timestamptz, done_at timestamptz, other_name text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.id,
         case when r.passenger_id = public.services_account_id() then 'passenger' else 'driver' end,
         r.status, r.pick_text, r.drop_text, r.fare_paise, r.created_at, r.done_at,
         case when r.passenger_id = public.services_account_id() then w.full_name else s.full_name end::text
    from public.services_rides r
    left join public.services_workers w on w.id = r.driver_work
    left join public.services_signups s on s.id = r.passenger_id
   where r.status in ('done', 'cancelled', 'expired')
     and r.created_at > now() - interval '90 days'
     and (r.passenger_id = public.services_account_id() or w.user_id = public.services_account_id())
   order by r.created_at desc
   limit 40;
$fn$;
revoke all on function public.services_ride_history() from public, anon, authenticated;
grant execute on function public.services_ride_history() to authenticated;
notify pgrst, 'reload schema';
select 'done' as "138";
