-- ===========================================================================
-- 118_part1.sql -- ALERTS WHEN THE APP IS CLOSED (web push). A phone that
-- says yes is stored here as an address plus two keys, nothing else. Events
-- go into a queue; a small edge function sends them (see PUSH.md).
-- ===========================================================================
create table if not exists public.services_push_subs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.services_signups(id) on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) <= 1000),
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  lang       text not null default 'en' check (char_length(lang) <= 5),
  created_at timestamptz not null default now()
);
create index if not exists services_push_subs_user_idx on public.services_push_subs (user_id);
alter table public.services_push_subs enable row level security;
revoke all on public.services_push_subs from public, anon, authenticated;

create table if not exists public.services_notify_queue (
  id         bigserial primary key,
  user_id    uuid not null,
  kind       text not null,
  extra      text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index if not exists services_notify_queue_idx on public.services_notify_queue (sent_at, created_at);
alter table public.services_notify_queue enable row level security;
revoke all on public.services_notify_queue from public, anon, authenticated;

select 'part 1 of 6 done' as "118_part1";
