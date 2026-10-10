-- ===========================================================================
-- 199: the chat inbox also carries the worker's listed rate (per day, rupees)
-- so a booking can show what the worker charges. Both sides also get each
-- other's phone while a request is waiting or accepted, so either can call. Replaces the 141 function.
-- ===========================================================================
alter table public.services_signups add column if not exists avatar_url text;
alter table public.services_bookings add column if not exists prev_start_at timestamptz;
alter table public.services_bookings add column if not exists resched_by text;

drop function if exists public.services_chat_inbox();
create function public.services_chat_inbox()
returns table (id uuid, role text, status text, other_name text, other_phone text, note text,
               start_at timestamptz, duration_mins int, created_at timestamptz,
               closes_at timestamptz, last_body text, last_at timestamptz, last_mine boolean, unread int, trade_name text, rate_min int, rate_max int, other_avatar text, prev_start_at timestamptz, resched_by text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  with me as (select public.services_account_id() as id),
  mine as (
    select b.*, case when b.customer_id = (select id from me) then 'customer' else 'worker' end as role,
           coalesce(nullif(w.business_name, ''), w.full_name) as wname, w.phone as wphone, w.avatar_url as wavatar, coalesce(c.avatar_url, (select w2.avatar_url from public.services_workers w2 where w2.user_id = b.customer_id and w2.avatar_url is not null limit 1)) as cavatar, w.day_rate_min as rmin, w.day_rate_max as rmax, t.name_en as tname, c.full_name as cname, c.phone as cphone,
           coalesce((select h.hidden_at from public.services_chat_hidden h
                      where h.booking_id = b.id and h.account_id = (select id from me)), 'epoch') as hid_at
      from public.services_bookings b
      join public.services_workers w on w.id = b.worker_id
      left join public.services_trades t on t.slug = w.trade_slug
      join public.services_signups c on c.id = b.customer_id
     where (b.customer_id = (select id from me) or w.user_id = (select id from me))
       and (b.closed_at is null or b.closed_at > now() - interval '24 hours')
       and not exists (select 1 from public.services_chat_hidden h
                        where h.booking_id = b.id and h.account_id = (select id from me) and h.hide_thread)
  )
  select m.id, m.role, m.status,
         (case when m.role = 'customer' then m.wname else m.cname end)::text,
         (case when m.status in ('requested', 'accepted') then (case when m.role = 'customer' then m.wphone else m.cphone end) end)::text,
         m.note, m.start_at, m.duration_mins, m.created_at,
         m.closed_at + interval '24 hours',
         l.body::text, l.created_at, (l.sender_id = (select id from me)),
         (select count(*)::int from public.services_chat_messages x
           where x.booking_id = m.id and x.sender_id <> (select id from me) and x.created_at > m.hid_at
             and x.created_at > coalesce((select r.read_at from public.services_chat_reads r
                                           where r.booking_id = m.id and r.account_id = (select id from me)), 'epoch')),
         m.tname::text, m.rmin::int, m.rmax::int,
         (case when m.role = 'customer' then m.wavatar else m.cavatar end)::text,
         m.prev_start_at, m.resched_by::text
    from mine m
    left join lateral (select x.body, x.created_at, x.sender_id from public.services_chat_messages x
                        where x.booking_id = m.id and x.created_at > m.hid_at
                        order by x.created_at desc limit 1) l on true
   order by coalesce(l.created_at, m.created_at) desc;
$fn$;
revoke all on function public.services_chat_inbox() from public, anon, authenticated;
grant execute on function public.services_chat_inbox() to authenticated;

notify pgrst, 'reload schema';
select '199 inbox rate done' as "199";
