-- ===========================================================================
-- 206_booking_done_rate.sql -- the worker can mark a booking completed
-- before its time is up, and the worker can rate the customer afterwards (the
-- customer rates the worker with services_review_add, kind 'hire', from 205).
-- Run after 201 and 205.
-- ===========================================================================
create table if not exists public.services_booking_rates (
  booking_id uuid not null references public.services_bookings(id) on delete cascade,
  stars      int  not null check (stars between 1 and 5),
  comment    text check (comment is null or char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  primary key (booking_id)
);
alter table public.services_booking_rates enable row level security;
revoke all on public.services_booking_rates from public, anon, authenticated;

create or replace function public.services_booking_complete(p_id uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  b record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  select bk.id, bk.status, bk.customer_id into b
    from public.services_bookings bk
    join public.services_workers w on w.id = bk.worker_id
   where bk.id = p_id and w.user_id = v_me;
  if b.id is null then
    return query select false, 'not_found'::text;
    return;
  end if;
  if b.status <> 'accepted' then
    return query select false, 'not_accepted'::text;
    return;
  end if;
  update public.services_bookings set status = 'completed' where id = p_id;
  insert into public.services_chat_messages (booking_id, sender_id, body)
  values (p_id, b.customer_id, 'Completed'), (p_id, v_me, 'Completed');
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_booking_complete(uuid) from public, anon;
grant execute on function public.services_booking_complete(uuid) to authenticated;

create or replace function public.services_booking_rate(p_id uuid, p_stars int, p_comment text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  b record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  if p_stars is null or p_stars not between 1 and 5 then
    return query select false, 'bad_stars'::text;
    return;
  end if;
  select bk.id, bk.status into b
    from public.services_bookings bk
    join public.services_workers w on w.id = bk.worker_id
   where bk.id = p_id and w.user_id = v_me;
  if b.id is null then
    return query select false, 'not_found'::text;
    return;
  end if;
  if b.status <> 'completed' then
    return query select false, 'not_completed'::text;
    return;
  end if;
  insert into public.services_booking_rates (booking_id, stars, comment)
  values (p_id, p_stars, nullif(left(btrim(coalesce(p_comment, '')), 300), ''))
  on conflict (booking_id) do nothing;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_booking_rate(uuid, int, text) from public, anon;
grant execute on function public.services_booking_rate(uuid, int, text) to authenticated;

-- The ratings I have already given on these bookings (as customer or worker).
create or replace function public.services_my_booking_rated(p_ids uuid[])
returns table (booking_id uuid, stars int, comment text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.ref_id, r.stars, r.comment from public.services_reviews r
   where r.kind = 'hire' and r.ref_id = any (p_ids) and r.reviewer_id = public.services_account_id()
  union all
  select br.booking_id, br.stars, br.comment from public.services_booking_rates br
    join public.services_bookings b on b.id = br.booking_id
    join public.services_workers w on w.id = b.worker_id
   where br.booking_id = any (p_ids) and w.user_id = public.services_account_id();
$fn$;
revoke all on function public.services_my_booking_rated(uuid[]) from public, anon;
grant execute on function public.services_my_booking_rated(uuid[]) to authenticated;
notify pgrst, 'reload schema';
select '206 booking done rate done' as "206";
