-- ===========================================================================
-- 116_part2.sql -- orders and their lines.
-- ===========================================================================
create table if not exists public.services_orders (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.services_signups(id) on delete cascade,
  worker_id   uuid not null references public.services_workers(id) on delete cascade,
  mode        text not null check (mode in ('delivery', 'pickup')),
  address_text text check (address_text is null or char_length(address_text) <= 250),
  lat         double precision check (lat is null or lat between 6 and 38),
  lng         double precision check (lng is null or lng between 67 and 98),
  note        text check (note is null or char_length(note) <= 300),
  total_paise int not null check (total_paise >= 0),
  status      text not null default 'placed'
              check (status in ('placed', 'accepted', 'ready', 'delivered', 'rejected', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists services_orders_cust_idx on public.services_orders (customer_id, created_at desc);
create index if not exists services_orders_work_idx on public.services_orders (worker_id, status, created_at desc);
alter table public.services_orders enable row level security;
revoke all on public.services_orders from public, anon, authenticated;

create table if not exists public.services_order_lines (
  order_id    uuid not null references public.services_orders(id) on delete cascade,
  item_id     uuid,
  name        text not null,
  price_paise int not null,
  qty         int not null check (qty between 1 and 20)
);
create index if not exists services_order_lines_idx on public.services_order_lines (order_id);
alter table public.services_order_lines enable row level security;
revoke all on public.services_order_lines from public, anon, authenticated;

select 'part 2 of 8 done' as "116_part2";
