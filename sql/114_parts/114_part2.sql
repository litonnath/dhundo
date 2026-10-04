-- ===========================================================================
-- 114_part2.sql -- the worker answers; the customer can cancel.
-- ===========================================================================
create or replace function public.services_booking_answer(p_id uuid, p_accept boolean)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  update public.services_bookings b
     set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now()
   where b.id = p_id and b.status = 'requested'
     and exists (select 1 from public.services_workers w where w.id = b.worker_id and w.user_id = v_me);
  if not found then
    return query select false, 'not_allowed'::text;
    return;
  end if;
  return query select true, case when p_accept then 'accepted' else 'declined' end::text;
end;
$fn$;
revoke all on function public.services_booking_answer(uuid, boolean) from public, anon, authenticated;
grant execute on function public.services_booking_answer(uuid, boolean) to authenticated;

create or replace function public.services_booking_cancel(p_id uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  update public.services_bookings b set status = 'cancelled', answered_at = now()
   where b.id = p_id and b.customer_id = public.services_account_id()
     and b.status in ('requested', 'accepted');
  if not found then
    return query select false, 'not_allowed'::text;
    return;
  end if;
  return query select true, 'cancelled'::text;
end;
$fn$;
revoke all on function public.services_booking_cancel(uuid) from public, anon, authenticated;
grant execute on function public.services_booking_cancel(uuid) to authenticated;

select 'part 2 of 3 done' as "114_part2";
