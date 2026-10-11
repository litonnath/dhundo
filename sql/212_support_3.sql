-- ===========================================================================
-- 212_support_3.sql -- help & support chat, part 3 of 3: what the admin sees and
-- does. Run after 212_support_2.sql.
-- ===========================================================================
create or replace function public.services_admin_support_list(p_status text default 'open')
returns table (id uuid, topic text, ref text, status text, unread boolean, name text, phone text,
               created_at timestamptz, updated_at timestamptz, last_body text)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  return query
    select t.id, t.topic, t.ref, t.status, t.unread_agent, s.full_name::text, s.phone::text,
           t.created_at, t.updated_at,
           (select m.body from public.services_support_messages m where m.ticket_id = t.id order by m.created_at desc limit 1)
      from public.services_support_tickets t
      join public.services_signups s on s.id = t.account_id
     where p_status = 'all' or t.status = p_status
     order by t.unread_agent desc, t.updated_at desc limit 200;
end;
$fn$;
revoke all on function public.services_admin_support_list(text) from public, anon;
grant execute on function public.services_admin_support_list(text) to authenticated;

create or replace function public.services_admin_support_thread(p_ticket uuid)
returns table (id uuid, sender text, body text, created_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  update public.services_support_tickets set unread_agent = false where public.services_support_tickets.id = p_ticket and unread_agent;
  return query select m.id, m.sender, m.body, m.created_at
    from public.services_support_messages m where m.ticket_id = p_ticket order by m.created_at;
end;
$fn$;
revoke all on function public.services_admin_support_thread(uuid) from public, anon;
grant execute on function public.services_admin_support_thread(uuid) to authenticated;

create or replace function public.services_admin_support_reply(p_ticket uuid, p_body text)
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  if length(btrim(coalesce(p_body, ''))) < 1 then
    return query select false;
    return;
  end if;
  insert into public.services_support_messages (ticket_id, sender, body) values (p_ticket, 'agent', left(btrim(p_body), 1000));
  update public.services_support_tickets set updated_at = now(), unread_user = true, unread_agent = false where id = p_ticket;
  return query select true;
end;
$fn$;
revoke all on function public.services_admin_support_reply(uuid, text) from public, anon;
grant execute on function public.services_admin_support_reply(uuid, text) to authenticated;

create or replace function public.services_admin_support_status(p_ticket uuid, p_status text)
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  update public.services_support_tickets set status = case when p_status = 'closed' then 'closed' else 'open' end, updated_at = now() where id = p_ticket;
  return query select true;
end;
$fn$;
revoke all on function public.services_admin_support_status(uuid, text) from public, anon;
grant execute on function public.services_admin_support_status(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select '212 support part 3 done' as "212_3";
