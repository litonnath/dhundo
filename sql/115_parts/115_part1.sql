-- ===========================================================================
-- 115_part1.sql -- RIDE REQUESTS. A passenger gives a pickup and a
-- destination; drivers who are online near the pickup see it and the first
-- to accept gets it. The fare is agreed between the two, outside the app.
-- Needs 80 (presence), 93 (rate guard).
-- ===========================================================================
create table if not exists public.services_rides (
  id           uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.services_signups(id) on delete cascade,
  pick_text    text not null check (char_length(pick_text) between 2 and 200),
  pick_lat     double precision not null check (pick_lat between 6 and 38),
  pick_lng     double precision not null check (pick_lng between 67 and 98),
  drop_text    text not null check (char_length(drop_text) between 2 and 200),
  drop_lat     double precision check (drop_lat is null or drop_lat between 6 and 38),
  drop_lng     double precision check (drop_lng is null or drop_lng between 67 and 98),
  vehicle      text not null default 'any' check (vehicle in ('any', 'bike', 'auto', 'car')),
  fare_paise   int check (fare_paise is null or fare_paise between 0 and 5000000),
  status       text not null default 'open'
               check (status in ('open', 'accepted', 'done', 'cancelled', 'expired')),
  driver_work  uuid references public.services_workers(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '20 minutes'),
  accepted_at  timestamptz,
  done_at      timestamptz
);
create index if not exists services_rides_open_idx on public.services_rides (status, expires_at);
create index if not exists services_rides_pass_idx on public.services_rides (passenger_id, created_at desc);
alter table public.services_rides enable row level security;
revoke all on public.services_rides from public, anon, authenticated;

select 'part 1 of 6 done' as "115_part1";
