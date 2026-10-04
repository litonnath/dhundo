-- ===========================================================================
-- 115_part6.sql -- finish, cancel, or hand a ride back.
-- ===========================================================================
create or replace function public.services_ride_update(p_ride uuid, p_action text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_n int := 0;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  if p_action = 'cancel' then
    update public.services_rides set status = 'cancelled', done_at = now()
     where id = p_ride and passenger_id = v_me and status in ('open', 'accepted');
    get diagnostics v_n = row_count;
  elsif p_action = 'done' then
    update public.services_rides r set status = 'done', done_at = now()
     where r.id = p_ride and r.status = 'accepted'
       and exists (select 1 from public.services_workers w
                    where w.id = r.driver_work and w.user_id = v_me);
    get diagnostics v_n = row_count;
  elsif p_action = 'release' then
    update public.services_rides r set status = 'open', driver_work = null, accepted_at = null
     where r.id = p_ride and r.status = 'accepted' and r.expires_at > now()
       and exists (select 1 from public.services_workers w
                    where w.id = r.driver_work and w.user_id = v_me);
    get diagnostics v_n = row_count;
  end if;
  return query select v_n > 0, case when v_n > 0 then 'ok' else 'no_change' end::text;
end;
$fn$;
revoke all on function public.services_ride_update(uuid, text) from public, anon, authenticated;
grant execute on function public.services_ride_update(uuid, text) to authenticated;

notify pgrst, 'reload schema';
select 'part 6 of 6 done' as "115_part6";
