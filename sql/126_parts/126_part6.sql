-- ===========================================================================
-- 126_part6.sql -- the message list leaves out what this person has deleted.
-- ===========================================================================
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
     and m.created_at > coalesce((select h.hidden_at from public.services_chat_hidden h
                                   where h.booking_id = m.booking_id and h.account_id = public.services_account_id()), 'epoch')
   order by m.created_at
   limit 300;
$fn$;
revoke all on function public.services_chat_list(uuid) from public, anon, authenticated;
grant execute on function public.services_chat_list(uuid) to authenticated;

select 'part 6 of 7 done' as "126_part6";
