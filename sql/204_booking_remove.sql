-- ===========================================================================
-- 204_booking_remove.sql -- either person can delete a booking. It is removed
-- at once for both sides, with its chat. Run after 126 and 201.
-- ===========================================================================
create or replace function public.services_booking_remove(p_id uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  b record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('bkremove', v_me::text, 60, 3600);
  select bk.id, bk.status into b
    from public.services_bookings bk
    join public.services_workers w on w.id = bk.worker_id
   where bk.id = p_id and (bk.customer_id = v_me or w.user_id = v_me);
  if b.id is null then
    return query select false, 'not_found'::text;
    return;
  end if;
  delete from public.services_bookings where id = p_id;
  return query select true, 'deleted'::text;
end;
$fn$;
revoke all on function public.services_booking_remove(uuid) from public, anon;
grant execute on function public.services_booking_remove(uuid) to authenticated;
notify pgrst, 'reload schema';
select '204 booking remove done' as "204";
