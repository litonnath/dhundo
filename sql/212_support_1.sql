-- ===========================================================================
-- 212_support_1.sql -- help & support chat. A person opens a ticket from the
-- app (after the bot's quick answers) and chats with our team; the team
-- answers from the admin console. Part 1 of 3: tables, open a ticket, send a
-- message. Then run 212_support_2.sql and 212_support_3.sql.
-- ===========================================================================
create table if not exists public.services_support_tickets (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.services_signups(id) on delete cascade,
  topic       text not null check (char_length(topic) between 2 and 60),
  ref         text check (ref is null or char_length(ref) <= 80),
  status      text not null default 'open' check (status in ('open', 'closed')),
  unread_user  boolean not null default false,
  unread_agent boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists services_support_tickets_acc on public.services_support_tickets (account_id, updated_at desc);
create table if not exists public.services_support_messages (
  id        uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.services_support_tickets(id) on delete cascade,
  sender    text not null check (sender in ('user', 'agent')),
  body      text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists services_support_messages_t on public.services_support_messages (ticket_id, created_at);
alter table public.services_support_tickets enable row level security;
alter table public.services_support_messages enable row level security;
revoke all on public.services_support_tickets, public.services_support_messages from public, anon, authenticated;

create or replace function public.services_support_open(p_topic text, p_body text, p_ref text default null)
returns table (ok boolean, reason text, ticket_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_id uuid;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text, null::uuid;
    return;
  end if;
  perform public.services_rate_guard('support_open', v_me::text, 10, 86400);
  if length(btrim(coalesce(p_body, ''))) < 2 or length(btrim(coalesce(p_topic, ''))) < 2 then
    return query select false, 'bad_input'::text, null::uuid;
    return;
  end if;
  select t.id into v_id from public.services_support_tickets t
   where t.account_id = v_me and t.status = 'open' and t.topic = left(btrim(p_topic), 60)
   order by t.created_at desc limit 1;
  if v_id is null then
    insert into public.services_support_tickets (account_id, topic, ref)
    values (v_me, left(btrim(p_topic), 60), nullif(left(btrim(coalesce(p_ref, '')), 80), ''))
    returning id into v_id;
  end if;
  insert into public.services_support_messages (ticket_id, sender, body) values (v_id, 'user', left(btrim(p_body), 1000));
  update public.services_support_tickets set updated_at = now(), unread_agent = true where id = v_id;
  return query select true, 'saved'::text, v_id;
end;
$fn$;
revoke all on function public.services_support_open(text, text, text) from public, anon;
grant execute on function public.services_support_open(text, text, text) to authenticated;

create or replace function public.services_support_send(p_ticket uuid, p_body text)
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
  perform public.services_rate_guard('support_send', v_me::text, 60, 3600);
  if length(btrim(coalesce(p_body, ''))) < 1 then
    return query select false, 'bad_input'::text;
    return;
  end if;
  if not exists (select 1 from public.services_support_tickets t where t.id = p_ticket and t.account_id = v_me) then
    return query select false, 'not_found'::text;
    return;
  end if;
  insert into public.services_support_messages (ticket_id, sender, body) values (p_ticket, 'user', left(btrim(p_body), 1000));
  update public.services_support_tickets set updated_at = now(), unread_agent = true, status = 'open' where id = p_ticket;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_support_send(uuid, text) from public, anon;
grant execute on function public.services_support_send(uuid, text) to authenticated;

notify pgrst, 'reload schema';
select '212 support part 1 done' as "212_1";
