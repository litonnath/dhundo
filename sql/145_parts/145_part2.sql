-- 145 part 2: placing an order. A delivery order is refused if an item is too big
-- for a bike; a shop_delivery order is for those: the shop names the charge later.
-- Replaces 143 part 2.
alter table public.services_menu_items add column if not exists bike_ok boolean not null default true;

create or replace function public.services_order_place(
  p_worker uuid, p_lines jsonb, p_mode text, p_address text,
  p_lat double precision, p_lng double precision, p_note text)
returns table (ok boolean, reason text, order_id uuid, total_paise int)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_id uuid;
  v_total int;
  v_n int;
  v_fee int := 0;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text, null::uuid, null::int;
    return;
  end if;
  perform public.services_rate_guard('order_place', v_me::text, 20, 86400);
  if p_mode not in ('delivery', 'pickup', 'shop_delivery') or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 30
     or (p_mode in ('delivery', 'shop_delivery') and length(btrim(coalesce(p_address, ''))) < 3) then
    return query select false, 'bad_input'::text, null::uuid, null::int;
    return;
  end if;
  if not exists (select 1 from public.services_workers w
                  where w.id = p_worker and w.status = 'approved'
                    and public.services_is_open_now(w.open_time, w.close_time, w.accepting_orders)
                    and w.user_id <> v_me) then
    return query select false, 'closed'::text, null::uuid, null::int;
    return;
  end if;
  create temporary table if not exists _ord_lines (item uuid, qty int, nm text, pr int, bk boolean) on commit drop;
  delete from _ord_lines;
  insert into _ord_lines
    select m.id, least(greatest((l ->> 'qty')::int, 1), 20), m.name, m.price_paise, m.bike_ok
      from jsonb_array_elements(p_lines) l
      join public.services_menu_items m
        on m.id = (l ->> 'id')::uuid and m.worker_id = p_worker and m.available;
  select count(*), coalesce(sum(qty * pr), 0) into v_n, v_total from _ord_lines;
  if v_n = 0 or v_n <> jsonb_array_length(p_lines) then
    return query select false, 'bad_items'::text, null::uuid, null::int;
    return;
  end if;
  if p_mode = 'delivery' and exists (select 1 from _ord_lines where not bk) then
    return query select false, 'too_big'::text, null::uuid, null::int;
    return;
  end if;
  if p_mode = 'delivery' then
    v_fee := public.services_delivery_fee(p_worker, p_lat, p_lng);
  end if;
  insert into public.services_orders (customer_id, worker_id, mode, address_text, lat, lng, note, total_paise, delivery_fee_paise)
  values (v_me, p_worker, p_mode, nullif(left(btrim(coalesce(p_address, '')), 250), ''), p_lat, p_lng,
          nullif(left(btrim(coalesce(p_note, '')), 300), ''), v_total, v_fee)
  returning id into v_id;
  insert into public.services_order_lines (order_id, item_id, name, price_paise, qty)
    select v_id, item, nm, pr, qty from _ord_lines;
  return query select true, 'placed'::text, v_id, v_total;
end;
$fn$;
revoke all on function public.services_order_place(uuid, jsonb, text, text, double precision, double precision, text) from public, anon, authenticated;
grant execute on function public.services_order_place(uuid, jsonb, text, text, double precision, double precision, text) to authenticated;
notify pgrst, 'reload schema';
select 'part 2 of 3 done' as "145_part2";
