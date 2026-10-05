-- ===========================================================================
-- 126_part5.sql -- either person can delete a conversation, for both sides.
-- A request that is over (declined, cancelled, or finished) is removed
-- altogether; one still open only has its messages cleared.
-- ===========================================================================
drop function if exists public.services_chat_delete(uuid);
create function public.services_chat_delete(p_booking uuid)
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
  select bk.* into b
    from public.services_bookings bk
    join public.services_workers w on w.id = bk.worker_id
   where bk.id = p_booking and (bk.customer_id = v_me or w.user_id = v_me);
  if b.id is null then
    return query select false, 'not_found'::text;
    return;
  end if;
  if b.status in ('declined', 'cancelled')
     or (b.status = 'accepted' and b.start_at is not null and b.duration_mins is not null
         and b.start_at + make_interval(mins => b.duration_mins) < now()) then
    delete from public.services_bookings where id = b.id;
  else
    delete from public.services_chat_messages where booking_id = b.id;
  end if;
  return query select true, 'deleted'::text;
end;
$fn$;
revoke all on function public.services_chat_delete(uuid) from public, anon, authenticated;
grant execute on function public.services_chat_delete(uuid) to authenticated;
notify pgrst, 'reload schema';
select 'part 5 of 5 done' as "126_part5";
