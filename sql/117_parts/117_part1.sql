-- ===========================================================================
-- 117_part1.sql -- opening hours, delivery time, dish photos, and rider jobs
-- from orders. Needs 113 (jobs) and 116 (orders and menus).
-- ===========================================================================
alter table public.services_workers
  add column if not exists open_time time,
  add column if not exists close_time time,
  add column if not exists delivery_mins int check (delivery_mins is null or delivery_mins between 5 and 720),
  add column if not exists auto_rider boolean not null default true;

alter table public.services_menu_items
  add column if not exists photo_url text check (photo_url is null or (char_length(photo_url) <= 500 and photo_url like 'https://%'));

alter table public.services_orders
  add column if not exists job_id uuid references public.services_jobs(id) on delete set null;

select 'part 1 of 9 done' as "117_part1";
