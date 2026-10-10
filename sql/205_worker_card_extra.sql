-- ===========================================================================
-- 205_worker_card_extra.sql -- what a customer sees on a worker's card: the
-- rating, the worker's hourly / daily / monthly rates, and the customer's own
-- booking history with that worker. Also lets a customer review a worker after
-- a completed booking (kind 'hire'). Run after 123, 153, 201.
-- ===========================================================================
drop function if exists public.services_review_add(uuid, text, uuid, int, text, boolean);
create function public.services_review_add(p_worker uuid, p_kind text, p_ref uuid, p_stars int, p_comment text, p_complaint boolean)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_acc uuid := public.services_account_id();
  v_kind text := coalesce(nullif(p_kind, ''), 'order');
  v_w uuid := p_worker;
begin
  if v_acc is null then return query select false, 'signin'; return; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then return query select false, 'bad_stars'; return; end if;
  if v_kind = 'order' then
    select o.worker_id into v_w from public.services_orders o
     where o.id = p_ref and o.customer_id = v_acc and o.status = 'delivered';
    if v_w is null then return query select false, 'not_delivered'; return; end if;
  elsif v_kind = 'hire' then
    select b.worker_id into v_w from public.services_bookings b
     where b.id = p_ref and b.customer_id = v_acc and b.status = 'completed';
    if v_w is null then return query select false, 'not_completed'; return; end if;
  else
    return query select false, 'bad_kind'; return;
  end if;
  if exists (select 1 from public.services_workers w where w.id = v_w and w.user_id = v_acc) then
    return query select false, 'own'; return;
  end if;
  insert into public.services_reviews (worker_id, reviewer_id, kind, ref_id, stars, comment, complaint)
  values (v_w, v_acc, v_kind, p_ref, p_stars, nullif(left(btrim(coalesce(p_comment, '')), 300), ''), coalesce(p_complaint, false));
  return query select true, 'saved';
exception when unique_violation then
  return query select false, 'already';
end;
$fn$;
revoke all on function public.services_review_add(uuid, text, uuid, int, text, boolean) from public, anon, authenticated;
grant execute on function public.services_review_add(uuid, text, uuid, int, text, boolean) to authenticated;

create or replace function public.services_worker_card_extra(p_worker uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $fn$
  with me as (select public.services_account_id() as id)
  select jsonb_build_object(
    'avg', (select round(avg(r.stars)::numeric, 1) from public.services_reviews r where r.worker_id = p_worker),
    'n', (select count(*) from public.services_reviews r where r.worker_id = p_worker),
    'rates', coalesce((select jsonb_agg(jsonb_build_object('unit', x.unit, 'rupees', x.rupees))
                from (select r.unit, min(r.rupees) as rupees from public.services_rates r
                       where r.worker_id = p_worker and r.unit in ('hour', 'day', 'month') group by r.unit) x), '[]'::jsonb),
    'active_status', (select b.status from public.services_bookings b, me
                       where b.worker_id = p_worker and b.customer_id = me.id and b.status in ('requested', 'accepted')
                       order by b.created_at desc limit 1),
    'active_at', (select b.start_at from public.services_bookings b, me
                   where b.worker_id = p_worker and b.customer_id = me.id and b.status in ('requested', 'accepted')
                   order by b.created_at desc limit 1),
    'total', (select count(*) from public.services_bookings b, me where b.worker_id = p_worker and b.customer_id = me.id),
    'done', (select count(*) from public.services_bookings b, me where b.worker_id = p_worker and b.customer_id = me.id and b.status = 'completed'),
    'last_at', (select max(b.start_at) from public.services_bookings b, me where b.worker_id = p_worker and b.customer_id = me.id),
    'to_review', (select b.id from public.services_bookings b, me
                   where b.worker_id = p_worker and b.customer_id = me.id and b.status = 'completed'
                     and not exists (select 1 from public.services_reviews r where r.kind = 'hire' and r.ref_id = b.id and r.reviewer_id = me.id)
                   order by b.start_at desc limit 1));
$fn$;
revoke all on function public.services_worker_card_extra(uuid) from public;
grant execute on function public.services_worker_card_extra(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
select '205 worker card extra done' as "205";
