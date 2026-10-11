-- ===========================================================================
-- 212_support_2.sql -- help & support chat, part 2 of 3: the person's own list,
-- thread and close. Run after 212_support_1.sql.
-- ===========================================================================
create or replace function public.services_support_my()
returns table (id uuid, topic text, status text, unread boolean, updated_at timestamptz, last_body text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select t.id, t.topic, t.status, t.unread_user, t.updated_at,
         (select m.body from public.services_support_messages m where m.ticket_id = t.id order by m.created_at desc limit 1)
    from public.services_support_tickets t
   where t.account_id = public.services_account_id()
   order by t.updated_at desc limit 20;
$fn$;
revoke all on function public.services_support_my() from public, anon;
grant execute on function public.services_support_my() to authenticated;

create or replace function public.services_support_thread(p_ticket uuid)
returns table (id uuid, sender text, body text, created_at timestamptz, status text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not exists (select 1 from public.services_support_tickets t where t.id = p_ticket and t.account_id = public.services_account_id()) then
    return;
  end if;
  update public.services_support_tickets set unread_user = false where public.services_support_tickets.id = p_ticket and unread_user;
  return query
    select m.id, m.sender, m.body, m.created_at, t.status
      from public.services_support_messages m join public.services_support_tickets t on t.id = m.ticket_id
     where m.ticket_id = p_ticket order by m.created_at;
end;
$fn$;
revoke all on function public.services_support_thread(uuid) from public, anon;
grant execute on function public.services_support_thread(uuid) to authenticated;

create or replace function public.services_support_close(p_ticket uuid)
returns void
language sql
security definer
set search_path to 'public'
as $fn$
  update public.services_support_tickets set status = 'closed', updated_at = now()
   where id = p_ticket and account_id = public.services_account_id();
$fn$;
revoke all on function public.services_support_close(uuid) from public, anon;
grant execute on function public.services_support_close(uuid) to authenticated;
notify pgrst, 'reload schema';
select '212 support part 2 done' as "212_2";
