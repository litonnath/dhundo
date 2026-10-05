-- ===========================================================================
-- 126_part5.sql -- each person deletes only their own side. Deleting hides the
-- earlier messages from that person and leaves the other persons copy as it
-- was. A conversation that is over is also taken off that persons list. When
-- both have removed it, it is deleted for good. Re-running this is safe.
-- ===========================================================================
create table if not exists public.services_chat_hidden (
  booking_id  uuid not null references public.services_bookings(id) on delete cascade,
  account_id  uuid not null references public.services_signups(id) on delete cascade,
  hidden_at   timestamptz not null default now(),
  hide_thread boolean not null default false,
  primary key (booking_id, account_id)
);
alter table public.services_chat_hidden enable row level security;
revoke all on public.services_chat_hidden from public, anon, authenticated;

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
  v_over boolean;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  select bk.*, w.user_id as worker_account into b
    from public.services_bookings bk
    join public.services_workers w on w.id = bk.worker_id
   where bk.id = p_booking and (bk.customer_id = v_me or w.user_id = v_me);
  if b.id is null then
    return query select false, 'not_found'::text;
    return;
  end if;
  v_over := b.status in ('declined', 'cancelled')
            or (b.status = 'accepted' and b.start_at is not null and b.duration_mins is not null
                and b.start_at + make_interval(mins => b.duration_mins) < now());
  insert into public.services_chat_hidden (booking_id, account_id, hidden_at, hide_thread)
  values (b.id, v_me, now(), v_over)
  on conflict (booking_id, account_id)
  do update set hidden_at = now(), hide_thread = public.services_chat_hidden.hide_thread or excluded.hide_thread;
  -- Both people have taken it off their list: nothing left to keep.
  if v_over and (select count(*) from public.services_chat_hidden h
                  where h.booking_id = b.id and h.hide_thread) >= 2 then
    delete from public.services_bookings where id = b.id;
  end if;
  return query select true, 'deleted'::text;
end;
$fn$;
revoke all on function public.services_chat_delete(uuid) from public, anon, authenticated;
grant execute on function public.services_chat_delete(uuid) to authenticated;

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

drop function if exists public.services_chat_inbox();
create function public.services_chat_inbox()
returns table (id uuid, role text, status text, other_name text, other_phone text, note text,
               start_at timestamptz, duration_mins int, created_at timestamptz,
               closes_at timestamptz, last_body text, last_at timestamptz, last_mine boolean, unread int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  with me as (select public.services_account_id() as id),
  mine as (
    select b.*, case when b.customer_id = (select id from me) then 'customer' else 'worker' end as role,
           w.full_name as wname, w.phone as wphone, c.full_name as cname, c.phone as cphone,
           coalesce((select h.hidden_at from public.services_chat_hidden h
                      where h.booking_id = b.id and h.account_id = (select id from me)), 'epoch') as hid_at
      from public.services_bookings b
      join public.services_workers w on w.id = b.worker_id
      join public.services_signups c on c.id = b.customer_id
     where (b.customer_id = (select id from me) or w.user_id = (select id from me))
       and (b.closed_at is null or b.closed_at > now() - interval '24 hours')
       and not exists (select 1 from public.services_chat_hidden h
                        where h.booking_id = b.id and h.account_id = (select id from me) and h.hide_thread)
  )
  select m.id, m.role, m.status,
         (case when m.role = 'customer' then m.wname else m.cname end)::text,
         (case when m.status = 'accepted' then (case when m.role = 'customer' then m.wphone else m.cphone end) end)::text,
         m.note, m.start_at, m.duration_mins, m.created_at,
         m.closed_at + interval '24 hours',
         l.body::text, l.created_at, (l.sender_id = (select id from me)),
         (select count(*)::int from public.services_chat_messages x
           where x.booking_id = m.id and x.sender_id <> (select id from me) and x.created_at > m.hid_at
             and x.created_at > coalesce((select r.read_at from public.services_chat_reads r
                                           where r.booking_id = m.id and r.account_id = (select id from me)), 'epoch'))
    from mine m
    left join lateral (select x.body, x.created_at, x.sender_id from public.services_chat_messages x
                        where x.booking_id = m.id and x.created_at > m.hid_at
                        order by x.created_at desc limit 1) l on true
   order by coalesce(l.created_at, m.created_at) desc;
$fn$;
revoke all on function public.services_chat_inbox() from public, anon, authenticated;
grant execute on function public.services_chat_inbox() to authenticated;

notify pgrst, 'reload schema';
select 'part 5 of 5 done' as "126_part5";
