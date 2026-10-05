-- ===========================================================================
-- 126_part1.sql -- one chat per booking request, between the customer and the
-- worker only. It is open while the request is waiting or accepted, closed the
-- moment it is declined or cancelled, and everything is gone 24 hours later.
-- Needs 93 (services_rate_guard) and 119 (bookings with start_at).
-- ===========================================================================
alter table public.services_bookings add column if not exists closed_at timestamptz;

create or replace function public.services_bookings_stamp_closed()
returns trigger
language plpgsql
as $fn$
begin
  if new.status in ('declined', 'cancelled') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.closed_at := now();
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_bookings_closed_at on public.services_bookings;
create trigger services_bookings_closed_at before insert or update on public.services_bookings
  for each row execute function public.services_bookings_stamp_closed();
update public.services_bookings set closed_at = coalesce(answered_at, created_at)
 where status in ('declined', 'cancelled') and closed_at is null;

create table if not exists public.services_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.services_bookings(id) on delete cascade,
  sender_id  uuid not null references public.services_signups(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists services_chat_booking_idx on public.services_chat_messages (booking_id, created_at);
alter table public.services_chat_messages enable row level security;
revoke all on public.services_chat_messages from public, anon, authenticated;

select 'part 1 of 3 done' as "126_part1";
