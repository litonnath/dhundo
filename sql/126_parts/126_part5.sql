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

select 'part 5 of 7 done' as "126_part5";
