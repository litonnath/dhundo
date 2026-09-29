-- 84 part 1 of 6: Buy and Sell. The items people sell, and reports on them.
-- Tables are closed to direct access; everything goes through functions.

create table if not exists public.services_items (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.services_signups(id) on delete cascade,
  title        text not null check (length(btrim(title)) between 3 and 80),
  description  text check (description is null or length(description) <= 2000),
  category     text not null check (category in ('bikes','cars','mobiles','electronics',
                 'appliances','furniture','building','tools','other')),
  price        integer not null check (price between 0 and 100000000),
  negotiable   boolean not null default true,
  condition    text not null default 'used'
                 check (condition in ('new','like_new','used','for_parts')),
  brand        text check (brand is null or length(brand) <= 60),
  model_year   int check (model_year is null or model_year between 1950 and 2100),
  km_driven    int check (km_driven is null or km_driven between 0 and 2000000),
  photos       text[] not null default '{}' check (cardinality(photos) between 1 and 6),
  state        text not null,
  city         text,
  locality     text,
  lat          double precision,
  lng          double precision,
  whatsapp     boolean not null default true,
  status       text not null default 'active' check (status in ('active','sold','removed')),
  hidden       boolean not null default false,
  report_count int not null default 0,
  views        int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '30 days'
);

create index if not exists services_items_live on public.services_items (state, category)
  where status = 'active' and not hidden;
create index if not exists services_items_seller on public.services_items (seller_id);
create index if not exists services_items_geo on public.services_items (lat, lng)
  where status = 'active' and not hidden;

create table if not exists public.services_item_reports (
  item_id     uuid not null references public.services_items(id) on delete cascade,
  reporter_id uuid not null references public.services_signups(id) on delete cascade,
  reason      text not null,
  note        text,
  created_at  timestamptz not null default now(),
  primary key (item_id, reporter_id)
);

create table if not exists public.services_item_reveals (
  item_id   uuid not null references public.services_items(id) on delete cascade,
  viewer_id uuid not null references public.services_signups(id) on delete cascade,
  at        timestamptz not null default now()
);
create index if not exists services_item_reveals_viewer on public.services_item_reveals (viewer_id, at);

alter table public.services_items        enable row level security;
alter table public.services_item_reports enable row level security;
alter table public.services_item_reveals enable row level security;
revoke all on public.services_items, public.services_item_reports, public.services_item_reveals
  from public, anon, authenticated;

create or replace function public.services_item_no(p_reason text)
returns jsonb language sql immutable as $fn$
  select jsonb_build_object('ok', false, 'reason', p_reason) $fn$;

-- When an item goes, its photos go too: queued for the same sweeper that
-- removes listing photos.
create or replace function public.services_items_queue_photos()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare p text;
begin
  foreach p in array coalesce(old.photos, '{}') loop
    perform public.services_queue_delete('services-photos',
      regexp_replace(p, '^.*/object/public/services-photos/', ''));
  end loop;
  return old;
end;
$fn$;

drop trigger if exists services_items_photos_gone on public.services_items;
create trigger services_items_photos_gone
  after delete on public.services_items
  for each row execute function public.services_items_queue_photos();


notify pgrst, 'reload schema';
select 'part 1 done: tables ' ||
  (select count(*) from pg_class where relname in
     ('services_items','services_item_reports','services_item_reveals'))::text
  || ' of 3' as "84_part1";
