-- ===========================================================================
-- 116_part1.sql -- FOOD ORDERS. A restaurant or shop keeps a menu; a customer
-- picks items and places an order for delivery or pickup; the owner accepts.
-- No payment is taken in the app: they settle it between themselves.
-- Needs 93 (services_rate_guard).
-- ===========================================================================
alter table public.services_workers
  add column if not exists accepting_orders boolean not null default true;

create table if not exists public.services_menu_items (
  id          uuid primary key default gen_random_uuid(),
  worker_id   uuid not null references public.services_workers(id) on delete cascade,
  category    text not null default 'Menu' check (char_length(category) between 1 and 40),
  name        text not null check (char_length(name) between 2 and 80),
  about       text check (about is null or char_length(about) <= 200),
  price_paise int not null check (price_paise between 100 and 2000000),
  veg         boolean not null default true,
  available   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists services_menu_worker_idx on public.services_menu_items (worker_id, available);
alter table public.services_menu_items enable row level security;
revoke all on public.services_menu_items from public, anon, authenticated;

select 'part 1 of 8 done' as "116_part1";
