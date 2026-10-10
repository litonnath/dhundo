-- ===========================================================================
-- 187_delivery_ratings.sql -- after a delivery, the customer rates the rider and
-- the rider rates the customer: 1 to 5 stars, a few words, or a complaint. One
-- rating each way per order. Each person can read the ratings they received.
-- ===========================================================================
create table if not exists public.services_delivery_ratings (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.services_orders(id) on delete cascade,
  by_role    text not null check (by_role in ('customer', 'rider')),
  from_account uuid not null,
  to_account   uuid not null,
  stars      int not null check (stars between 1 and 5),
  comment    text check (comment is null or char_length(comment) <= 300),
  complaint  boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, by_role)
);
create index if not exists services_delivery_ratings_to on public.services_delivery_ratings (to_account, created_at desc);
alter table public.services_delivery_ratings enable row level security;
revoke all on public.services_delivery_ratings from public, anon, authenticated;

create or replace function public.services_delivery_rate(p_order uuid, p_stars int, p_comment text, p_complaint boolean)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  o record;
  v_rider uuid;
  v_role text;
  v_to uuid;
begin
  if v_me is null then return query select false, 'signin'::text; return; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then return query select false, 'bad_stars'::text; return; end if;
  select x.* into o from public.services_orders x where x.id = p_order and x.status = 'delivered' and x.job_id is not null;
  if not found then return query select false, 'not_delivered'::text; return; end if;
  select w.user_id into v_rider from public.services_jobs j join public.services_workers w on w.id = j.rider_work where j.id = o.job_id;
  if v_rider is null then return query select false, 'no_rider'::text; return; end if;
  if o.customer_id = v_me then v_role := 'customer'; v_to := v_rider;
  elsif v_rider = v_me then v_role := 'rider'; v_to := o.customer_id;
  else return query select false, 'not_allowed'::text; return; end if;
  insert into public.services_delivery_ratings (order_id, by_role, from_account, to_account, stars, comment, complaint)
  values (o.id, v_role, v_me, v_to, p_stars, nullif(left(btrim(coalesce(p_comment, '')), 300), ''), coalesce(p_complaint, false));
  return query select true, 'saved'::text;
exception when unique_violation then
  return query select false, 'already'::text;
end;
$fn$;
revoke all on function public.services_delivery_rate(uuid, int, text, boolean) from public, anon;
grant execute on function public.services_delivery_rate(uuid, int, text, boolean) to authenticated;

-- The ratings I received, newest first.
create or replace function public.services_my_delivery_ratings()
returns table (stars int, comment text, complaint boolean, by_role text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.stars, r.comment, r.complaint, r.by_role, r.created_at
    from public.services_delivery_ratings r
   where r.to_account = public.services_account_id()
   order by r.created_at desc limit 50;
$fn$;
revoke all on function public.services_my_delivery_ratings() from public, anon;
grant execute on function public.services_my_delivery_ratings() to authenticated;

-- Which of these orders have I already rated (to hide the box).
create or replace function public.services_delivery_rated(p_orders uuid[])
returns table (order_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.order_id from public.services_delivery_ratings r
   where r.from_account = public.services_account_id() and r.order_id = any (coalesce(p_orders, '{}'::uuid[]));
$fn$;
revoke all on function public.services_delivery_rated(uuid[]) from public, anon;
grant execute on function public.services_delivery_rated(uuid[]) to authenticated;
notify pgrst, 'reload schema';
select '187 delivery ratings done' as "187";
