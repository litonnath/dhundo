-- 149 part 2: the buyer asks to book an item.
create or replace function public.services_item_buy(p_item uuid, p_mode text, p_offer_rupees int, p_note text)
returns table (ok boolean, reason text, order_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  i record;
  v_id uuid;
  v_offer int;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text, null::uuid;
    return;
  end if;
  perform public.services_rate_guard('item_buy', v_me::text, 30, 86400);
  select x.* into i from public.services_items x
   where x.id = p_item and x.status = 'active' and not x.hidden and x.expires_at > now();
  if not found then
    return query select false, 'gone'::text, null::uuid;
    return;
  end if;
  if i.seller_id = v_me then
    return query select false, 'own_item'::text, null::uuid;
    return;
  end if;
  if exists (select 1 from public.services_item_orders o
              where o.item_id = p_item and o.buyer_id = v_me and o.status in ('requested', 'accepted')) then
    return query select false, 'already_open'::text, null::uuid;
    return;
  end if;
  v_offer := case when i.negotiable and coalesce(p_offer_rupees, 0) between 1 and i.price then p_offer_rupees else i.price end;
  insert into public.services_item_orders (item_id, buyer_id, seller_id, mode, offer_rupees, note)
  values (p_item, v_me, i.seller_id, case when p_mode = 'delivery' then 'delivery' else 'pickup' end, v_offer,
          nullif(left(btrim(coalesce(p_note, '')), 300), ''))
  returning id into v_id;
  perform public.services_notify(i.seller_id, 'item_req', left(i.title, 60));
  return query select true, 'sent'::text, v_id;
end;
$fn$;
revoke all on function public.services_item_buy(uuid, text, int, text) from public, anon, authenticated;
grant execute on function public.services_item_buy(uuid, text, int, text) to authenticated;
notify pgrst, 'reload schema';
select 'part 2 of 4 done' as "149_part2";
