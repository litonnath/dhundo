-- 135: messages between the passenger and the driver of an accepted ride.
-- Saved in the database, so every message is still there when the screen is
-- reopened. They go when the ride row is removed.
create table if not exists public.services_ride_messages (
  id         uuid primary key default gen_random_uuid(),
  ride_id    uuid not null references public.services_rides(id) on delete cascade,
  sender_id  uuid not null references public.services_signups(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists services_ride_messages_idx on public.services_ride_messages (ride_id, created_at);
alter table public.services_ride_messages enable row level security;
revoke all on public.services_ride_messages from public, anon, authenticated;

create or replace function public.services_ride_chat_list(p_ride uuid)
returns table (id uuid, mine boolean, body text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select m.id, m.sender_id = public.services_account_id(), m.body, m.created_at
    from public.services_ride_messages m
    join public.services_rides r on r.id = m.ride_id
    left join public.services_workers w on w.id = r.driver_work
   where m.ride_id = p_ride
     and (r.passenger_id = public.services_account_id() or w.user_id = public.services_account_id())
   order by m.created_at
   limit 200;
$fn$;
revoke all on function public.services_ride_chat_list(uuid) from public, anon, authenticated;
grant execute on function public.services_ride_chat_list(uuid) to authenticated;

create or replace function public.services_ride_chat_send(p_ride uuid, p_body text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_other uuid;
  v_ok boolean;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('ridechat', v_me::text, 200, 3600);
  if length(btrim(coalesce(p_body, ''))) < 1 then
    return query select false, 'empty'::text;
    return;
  end if;
  select true,
         case when r.passenger_id = v_me then w.user_id else r.passenger_id end
    into v_ok, v_other
    from public.services_rides r
    left join public.services_workers w on w.id = r.driver_work
   where r.id = p_ride and r.status = 'accepted'
     and (r.passenger_id = v_me or w.user_id = v_me);
  if v_ok is null then
    return query select false, 'closed'::text;
    return;
  end if;
  insert into public.services_ride_messages (ride_id, sender_id, body)
  values (p_ride, v_me, left(btrim(p_body), 300));
  perform public.services_notify(v_other, 'ride_msg', left(btrim(p_body), 80));
  return query select true, 'sent'::text;
end;
$fn$;
revoke all on function public.services_ride_chat_send(uuid, text) from public, anon, authenticated;
grant execute on function public.services_ride_chat_send(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select 'done' as "135";
