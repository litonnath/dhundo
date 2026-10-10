-- 172 part 2: moving an order along. A delivery order looks for a rider halfway through the cooking time, or when the food is ready if that is earlier.
-- (145 part 3, changed.) Run after 172_rider_timing_1.sql.
-- For a shop_delivery order the shop first accepts (status confirmed), then names a
-- charge by distance (services_order_quote), then the customer accepts it (accept_quote). Replaces 143 part 4.
alter table public.services_orders add column if not exists delivery_fee_paise int not null default 0;

create or replace function public.services_order_update(p_order uuid, p_action text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_n int := 0;
  o record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  if p_action = 'cancel' then
    update public.services_orders set status = 'cancelled', updated_at = now()
     where id = p_order and customer_id = v_me and status in ('placed', 'confirmed', 'quoted');
    get diagnostics v_n = row_count;
  elsif p_action = 'accept_quote' then
    update public.services_orders set status = 'accepted', updated_at = now()
     where id = p_order and customer_id = v_me and status = 'quoted' and mode in ('shop_delivery', 'pickup');
    get diagnostics v_n = row_count;
  elsif p_action = 'choose_pickup' then
    -- the customer would rather collect it: before the shop has answered the order
    -- stays waiting as a pickup order; after the shop accepted, it is accepted
    update public.services_orders set mode = 'pickup', delivery_fee_paise = 0,
           status = case when status = 'placed' then 'placed' else 'accepted' end, updated_at = now()
     where id = p_order and customer_id = v_me and mode = 'shop_delivery' and status in ('placed', 'confirmed', 'quoted');
    get diagnostics v_n = row_count;
  elsif p_action = 'refuse_delivery' then
    -- the shop cannot deliver this one: it becomes a pickup order the customer
    -- can accept (collect it from the shop) or decline
    update public.services_orders x set mode = 'pickup', status = 'quoted', delivery_fee_paise = 0, updated_at = now()
     where x.id = p_order and x.mode = 'shop_delivery' and x.status in ('placed', 'confirmed')
       and exists (select 1 from public.services_workers w where w.id = x.worker_id and w.user_id = v_me);
    get diagnostics v_n = row_count;
  elsif p_action in ('accept', 'reject', 'ready', 'delivered') then
    update public.services_orders x
       set status = case p_action when 'accept' then (case when x.mode = 'shop_delivery' then 'confirmed' else 'accepted' end)
                                  when 'reject' then 'rejected'
                                  when 'ready' then 'ready' else 'delivered' end,
           updated_at = now()
     where x.id = p_order
       and exists (select 1 from public.services_workers w where w.id = x.worker_id and w.user_id = v_me)
       and ((p_action = 'accept' and x.status = 'placed')
         or (p_action = 'reject' and x.status in ('placed', 'confirmed', 'quoted'))
         or (p_action = 'ready' and x.status = 'accepted')
         or (p_action = 'delivered' and x.status in ('accepted', 'ready')))
    returning x.* into o;
    get diagnostics v_n = row_count;
    if v_n > 0 and p_action = 'accept' and o.mode = 'delivery' then
      -- the rider is looked for halfway through the cooking time (at least 5 min)
      update public.services_orders x
         set rider_after = now() + make_interval(mins => greatest(5, coalesce(
               (select w.delivery_mins from public.services_workers w where w.id = x.worker_id), 60) / 2))
       where x.id = o.id;
    elsif v_n > 0 and p_action = 'ready' and o.mode = 'delivery' then
      -- the food is ready early: look for the rider now
      perform public.services_order_post_job(o.id);
    end if;
  end if;
  return query select v_n > 0, case when v_n > 0 then 'ok' else 'no_change' end::text;
end;
$fn$;
revoke all on function public.services_order_update(uuid, text) from public, anon, authenticated;
grant execute on function public.services_order_update(uuid, text) to authenticated;

select '172 part 2 done' as "172_2";
