-- ===========================================================================
-- 126_part2.sql -- chat functions and the 24 hour clean-up.
-- ===========================================================================
create or replace function public.services_purge_chats()
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  -- Declined or cancelled more than 24 hours ago: the request and its chat go.
  delete from public.services_bookings
   where status in ('declined', 'cancelled') and closed_at < now() - interval '24 hours';
  -- Accepted work that ended more than 24 hours ago: only the chat goes.
  delete from public.services_chat_messages m
   using public.services_bookings b
   where b.id = m.booking_id and b.status = 'accepted'
     and b.start_at is not null and b.duration_mins is not null
     and b.start_at + make_interval(mins => b.duration_mins) < now() - interval '24 hours';
end;
$fn$;
revoke all on function public.services_purge_chats() from public, anon, authenticated;

drop function if exists public.services_chat_open(uuid);
create function public.services_chat_open(p_booking uuid)
returns table (is_open boolean, status text, other_name text, closes_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select b.status in ('requested', 'accepted'), b.status,
         case when b.customer_id = public.services_account_id() then w.full_name else c.full_name end::text,
         b.closed_at + interval '24 hours'
    from public.services_bookings b
    join public.services_workers w on w.id = b.worker_id
    join public.services_signups c on c.id = b.customer_id
   where b.id = p_booking
     and (b.customer_id = public.services_account_id() or w.user_id = public.services_account_id())
     and (b.closed_at is null or b.closed_at > now() - interval '24 hours');
$fn$;
revoke all on function public.services_chat_open(uuid) from public, anon, authenticated;
grant execute on function public.services_chat_open(uuid) to authenticated;

drop function if exists public.services_chat_list(uuid);
create function public.services_chat_list(p_booking uuid)
returns table (id uuid, mine boolean, body text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select m.id, m.sender_id = public.services_account_id(), m.body, m.created_at
    from public.services_chat_messages m
    join public.services_bookings b on b.id = m.booking_id
    join public.services_workers w on w.id = b.worker_id
   where m.booking_id = p_booking
     and (b.customer_id = public.services_account_id() or w.user_id = public.services_account_id())
     and (b.closed_at is null or b.closed_at > now() - interval '24 hours')
   order by m.created_at
   limit 300;
$fn$;
revoke all on function public.services_chat_list(uuid) from public, anon, authenticated;
grant execute on function public.services_chat_list(uuid) to authenticated;

drop function if exists public.services_chat_send(uuid, text);
create function public.services_chat_send(p_booking uuid, p_body text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_ok boolean;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('chat', v_me::text, 200, 3600);
  if length(btrim(coalesce(p_body, ''))) < 1 then
    return query select false, 'empty'::text;
    return;
  end if;
  select true into v_ok
    from public.services_bookings b
    join public.services_workers w on w.id = b.worker_id
   where b.id = p_booking and b.status in ('requested', 'accepted')
     and (b.customer_id = v_me or w.user_id = v_me);
  if v_ok is null then
    return query select false, 'closed'::text;
    return;
  end if;
  insert into public.services_chat_messages (booking_id, sender_id, body)
  values (p_booking, v_me, left(btrim(p_body), 500));
  -- A little housekeeping on the way: not worth a scheduled job.
  if random() < 0.05 then
    perform public.services_purge_chats();
  end if;
  return query select true, 'sent'::text;
end;
$fn$;
revoke all on function public.services_chat_send(uuid, text) from public, anon, authenticated;
grant execute on function public.services_chat_send(uuid, text) to authenticated;

select 'part 2 of 3 done' as "126_part2";
