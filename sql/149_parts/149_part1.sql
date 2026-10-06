-- 149 part 1: buying a second hand item on Dhundo, from request to handover.
-- A buyer asks to book an item (collect it, or the seller delivers); the seller
-- accepts or declines and, for delivery, names a delivery charge; the buyer gets
-- a four digit handover code and gives it to the seller when the item is in
-- their hands; the seller types it in and the sale is complete. Everything is
-- paid in cash at the handover. Tables are closed; functions do the work.
create table if not exists public.services_item_orders (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.services_items(id) on delete cascade,
  buyer_id     uuid not null references public.services_signups(id) on delete cascade,
  seller_id    uuid not null references public.services_signups(id) on delete cascade,
  mode         text not null default 'pickup' check (mode in ('pickup', 'delivery')),
  offer_rupees int not null check (offer_rupees between 0 and 100000000),
  delivery_fee_paise int not null default 0 check (delivery_fee_paise between 0 and 50000000),
  status       text not null default 'requested'
               check (status in ('requested', 'accepted', 'declined', 'cancelled', 'completed')),
  note         text check (note is null or char_length(note) <= 300),
  code         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists services_item_orders_buyer on public.services_item_orders (buyer_id, created_at desc);
create index if not exists services_item_orders_seller on public.services_item_orders (seller_id, created_at desc);
create unique index if not exists services_item_orders_open
  on public.services_item_orders (item_id, buyer_id) where status in ('requested', 'accepted');
alter table public.services_item_orders enable row level security;
revoke all on public.services_item_orders from public, anon, authenticated;

create table if not exists public.services_item_order_messages (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.services_item_orders(id) on delete cascade,
  sender_id  uuid not null references public.services_signups(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists services_item_order_messages_idx on public.services_item_order_messages (order_id, created_at);
alter table public.services_item_order_messages enable row level security;
revoke all on public.services_item_order_messages from public, anon, authenticated;
notify pgrst, 'reload schema';
select 'part 1 of 4 done' as "149_part1";
