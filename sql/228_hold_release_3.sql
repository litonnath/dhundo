-- 228_hold_release_3.sql -- part 3 of 3: a second hand item cannot be cancelled or declined once it is paid.
create or replace function public.services_item_order_update(p_order uuid, p_action text, p_fee_rupees int default null)
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
  select x.* into o from public.services_item_orders x where x.id = p_order for update;
  if not found or v_me not in (o.buyer_id, o.seller_id) then
    return query select false, 'not_found'::text;
    return;
  end if;
  if p_action = 'accept' and v_me = o.seller_id and o.status = 'requested' then
    update public.services_item_orders
       set status = 'accepted', updated_at = now(),
           code = lpad((floor(random() * 10000))::int::text, 4, '0'),
           delivery_fee_paise = case when o.mode = 'delivery' then least(greatest(coalesce(p_fee_rupees, 0), 0), 500000) * 100 else 0 end
     where id = p_order;
    update public.services_item_orders set status = 'declined', updated_at = now()
     where item_id = o.item_id and id <> p_order and status = 'requested';
    perform public.services_notify(o.buyer_id, 'item_accepted', null);
    v_n := 1;
  elsif p_action = 'decline' and v_me = o.seller_id and o.status in ('requested', 'accepted') and not (o.paid_online or o.paid_cash) then
    update public.services_item_orders set status = 'declined', updated_at = now() where id = p_order;
    perform public.services_notify(o.buyer_id, 'item_declined', null);
    v_n := 1;
  elsif p_action = 'cancel' and v_me = o.buyer_id and o.status in ('requested', 'accepted') and not (o.paid_online or o.paid_cash) then
    update public.services_item_orders set status = 'cancelled', updated_at = now() where id = p_order;
    v_n := 1;
  elsif p_action = 'switch_pickup' and v_me = o.buyer_id and o.status in ('requested', 'accepted') and o.mode = 'delivery' then
    update public.services_item_orders set mode = 'pickup', delivery_fee_paise = 0, updated_at = now() where id = p_order;
    v_n := 1;
  end if;
  return query select v_n > 0, case when v_n > 0 then 'ok' else 'no_change' end::text;
end;
$fn$;
revoke all on function public.services_item_order_update(uuid, text, int) from public, anon, authenticated;
grant execute on function public.services_item_order_update(uuid, text, int) to authenticated;
notify pgrst, 'reload schema';
select '228 hold release part 3 done' as "228_3";
