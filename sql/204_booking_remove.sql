-- ===========================================================================
-- 204_booking_remove.sql -- either person can delete a booking from their
-- list. A booking that is still waiting or accepted is cancelled first, so the
-- other person is told. It then disappears for the one who deleted it, and is
-- removed entirely once both have deleted it. Run after 126 and 201.
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
  if b.status in ('requested', 'accepted') then
    update public.services_bookings set status = 'cancelled' where id = p_id;
  end if;
  insert into public.services_chat_hidden (booking_id, account_id, hidden_at, hide_thread)
  values (p_id, v_me, now(), true)
  on conflict (booking_id, account_id) do update set hidden_at = now(), hide_thread = true;
  if (select count(*) from public.services_chat_hidden h where h.booking_id = p_id and h.hide_thread) >= 2 then
    delete from public.services_bookings where id = p_id;
  end if;
  return query select true, 'deleted'::text;
end;
$fn$;
revoke all on function public.services_booking_remove(uuid) from public, anon;
grant execute on function public.services_booking_remove(uuid) to authenticated;
notify pgrst, 'reload schema';
select '204 booking remove done' as "204";
