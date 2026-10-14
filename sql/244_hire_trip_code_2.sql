-- 244 part 2 of 2: Mark done needs the start code for scheduled rides and driver hires. Run after part 1.

create or replace function public.services_booking_complete(p_id uuid)
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
  select bk.id, bk.status, bk.customer_id, bk.note into b
    from public.services_bookings bk
    join public.services_workers w on w.id = bk.worker_id
   where bk.id = p_id and w.user_id = v_me;
  if b.id is null then
    return query select false, 'not_found'::text;
    return;
  end if;
  if b.status <> 'accepted' then
    return query select false, 'not_accepted'::text;
    return;
  end if;
  if public.services_booking_needs_code(p_id)
     and not exists (select 1 from public.services_plan_trips t where t.booking_id = p_id and t.started_at is not null) then
    return query select false, 'verify_first'::text;
    return;
  end if;
  update public.services_bookings set status = 'completed' where id = p_id;
  insert into public.services_chat_messages (booking_id, sender_id, body)
  values (p_id, b.customer_id, 'Completed'), (p_id, v_me, 'Completed');
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_booking_complete(uuid) from public, anon;
grant execute on function public.services_booking_complete(uuid) to authenticated;
notify pgrst, 'reload schema';
select '244 part 2 of 2 done' as "244_2";
