-- 80 part 1 of 4: the presence table and two helpers. Run this first.

create table if not exists public.services_presence (
  worker_id    uuid primary key references public.services_workers(id) on delete cascade,
  lat          double precision not null,
  lng          double precision not null,
  accuracy_m   real,
  online_until timestamptz not null,
  seen_at      timestamptz not null default now()
);

create index if not exists services_presence_live
  on public.services_presence (online_until, seen_at);

alter table public.services_presence enable row level security;
revoke all on public.services_presence from public, anon, authenticated;

create or replace function public.services_presence_fresh_minutes()
returns int language sql immutable as $$ select 30 $$;

create or replace function public.services_km(
  a_lat double precision, a_lng double precision,
  b_lat double precision, b_lng double precision)
returns double precision
language sql immutable
as $$
  select 6371.0 * 2 * asin(sqrt(
           power(sin(radians(b_lat - a_lat) / 2), 2) +
           cos(radians(a_lat)) * cos(radians(b_lat)) *
           power(sin(radians(b_lng - a_lng) / 2), 2)));
$$;

select 'part 1 done' as result;
