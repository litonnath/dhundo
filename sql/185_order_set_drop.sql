-- ===========================================================================
-- 185_order_set_drop.sql -- a customer can pin their location on an order that
-- was placed without one (older orders), so the rider's map and directions know
-- where the door is. Only the customer, only while the order is still on, and
-- only while no point is set.
-- ===========================================================================
create or replace function public.services_order_set_drop(p_order uuid, p_lat double precision, p_lng double precision)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if public.services_account_id() is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  if p_lat is null or p_lng is null or p_lat not between 6 and 38 or p_lng not between 67 and 98 then
    return query select false, 'bad_input'::text;
    return;
  end if;
  update public.services_orders
     set lat = p_lat, lng = p_lng
   where id = p_order and customer_id = public.services_account_id()
     and lat is null and status in ('placed', 'confirmed', 'quoted', 'accepted', 'ready');
  if not found then
    return query select false, 'no_change'::text;
    return;
  end if;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_order_set_drop(uuid, double precision, double precision) from public, anon;
grant execute on function public.services_order_set_drop(uuid, double precision, double precision) to authenticated;
notify pgrst, 'reload schema';
select '185 order set drop done' as "185";
