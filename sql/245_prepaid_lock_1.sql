-- 245 part 1 of 3: once a customer has paid online, the provider can no longer cancel or give the work back.
-- A ride's driver cannot release it. Run parts 1, 2, 3 in order.

create or replace function public.services_prepaid(p_purpose text, p_ref uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (select 1 from public.services_payments p
                  where p.purpose = p_purpose and p.ref_id = p_ref and p.status = 'paid' and p.refunded_at is null);
$fn$;
revoke all on function public.services_prepaid(text, uuid) from public, anon, authenticated;

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
  if p_action = 'release' and public.services_prepaid('ride', p_ride) then
    return query select false, 'prepaid_locked'::text;   -- the customer already paid: the driver keeps the ride
    return;
  end if;
  if p_action = 'cancel' then
    update public.services_rides set status = 'cancelled', done_at = now()
     where id = p_ride and passenger_id = v_me and status in ('open', 'accepted');
    get diagnostics v_n = row_count;
  elsif p_action = 'done' then
    update public.services_rides r set status = 'done', done_at = now()
     where r.id = p_ride and r.status = 'accepted' and r.started_at is not null
       and exists (select 1 from public.services_workers w
                    where w.id = r.driver_work and w.user_id = v_me);
    get diagnostics v_n = row_count;
  elsif p_action = 'release' then
    update public.services_rides r set status = 'open', driver_work = null, accepted_at = null,
           started_at = null, pickup_code = null
     where r.id = p_ride and r.status = 'accepted' and r.started_at is null and r.expires_at > now()
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
select '245 part 1 of 3 done' as "245_1";
