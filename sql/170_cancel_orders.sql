-- ===========================================================================
-- 170_cancel_orders.sql -- cancelling with a reason, by the customer, the shop
-- or restaurant, or the rider. Run after 164_orders_gst.sql.
--  * customer or shop cancels an order before it is delivered; its delivery
--    job is cancelled with it. A customer cannot cancel once the rider has
--    picked it up.
--  * a rider gives a job back before pickup; it goes out to other riders
--    again and the order is not cancelled.
-- Every cancellation is logged with who and why, for the admin.
-- ===========================================================================
alter table public.services_orders
  add column if not exists cancelled_by text check (cancelled_by in ('customer', 'shop')),
  add column if not exists cancel_reason text;

create table if not exists public.services_cancellations (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid references public.services_orders(id) on delete set null,
  job_id     uuid references public.services_jobs(id) on delete set null,
  by_role    text not null check (by_role in ('customer', 'shop', 'rider')),
  account_id uuid not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
alter table public.services_cancellations enable row level security;
revoke all on public.services_cancellations from public, anon, authenticated;

create or replace function public.services_order_cancel(p_order uuid, p_reason text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_why text := left(btrim(coalesce(p_reason, '')), 200);
  o record;
  v_role text;
  v_picked boolean;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  if char_length(v_why) < 2 then
    return query select false, 'reason_needed'::text;
    return;
  end if;
  perform public.services_rate_guard('order_cancel', v_me::text, 30, 86400);
  select x.* into o from public.services_orders x where x.id = p_order for update;
  if not found or o.status not in ('placed', 'confirmed', 'quoted', 'accepted', 'ready') then
    return query select false, 'no_change'::text;
    return;
  end if;
  if o.customer_id = v_me then
    v_role := 'customer';
  elsif exists (select 1 from public.services_workers w where w.id = o.worker_id and w.user_id = v_me) then
    v_role := 'shop';
  else
    return query select false, 'not_allowed'::text;
    return;
  end if;
  v_picked := o.job_id is not null
              and exists (select 1 from public.services_jobs j where j.id = o.job_id and j.status = 'picked_up');
  if v_picked and v_role = 'customer' then
    return query select false, 'already_picked_up'::text;
    return;
  end if;
  update public.services_orders
     set status = 'cancelled', cancelled_by = v_role, cancel_reason = v_why, updated_at = now()
   where id = o.id;
  if o.job_id is not null then
    update public.services_jobs set status = 'cancelled', done_at = now()
     where id = o.job_id and status in ('open', 'accepted', 'picked_up');
  end if;
  insert into public.services_cancellations (order_id, job_id, by_role, account_id, reason)
  values (o.id, o.job_id, v_role, v_me, v_why);
  return query select true, 'cancelled'::text;
end;
$fn$;
revoke all on function public.services_order_cancel(uuid, text) from public, anon;
grant execute on function public.services_order_cancel(uuid, text) to authenticated;

create or replace function public.services_job_rider_cancel(p_job uuid, p_reason text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_why text := left(btrim(coalesce(p_reason, '')), 200);
  j record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  if char_length(v_why) < 2 then
    return query select false, 'reason_needed'::text;
    return;
  end if;
  select x.* into j from public.services_jobs x where x.id = p_job for update;
  if not found or j.status <> 'accepted'
     or not exists (select 1 from public.services_workers w where w.id = j.rider_work and w.user_id = v_me) then
    return query select false, 'no_change'::text;
    return;
  end if;
  update public.services_jobs
     set status = 'open', rider_work = null, accepted_at = null,
         expires_at = now() + interval '30 minutes'
   where id = j.id;
  insert into public.services_cancellations (order_id, job_id, by_role, account_id, reason)
  values ((select o.id from public.services_orders o where o.job_id = j.id limit 1), j.id, 'rider', v_me, v_why);
  return query select true, 'released'::text;
end;
$fn$;
revoke all on function public.services_job_rider_cancel(uuid, text) from public, anon;
grant execute on function public.services_job_rider_cancel(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select '170 cancel orders done' as "170";
