-- 149 part 4: my buying and selling, and the messages on a request.
create or replace function public.services_my_item_orders()
returns table (id uuid, role text, status text, mode text, item_id uuid, title text, photo text,
               list_price int, offer_rupees int, delivery_fee_paise int, other_name text, other_phone text,
               note text, code text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select o.id, case when o.buyer_id = public.services_account_id() then 'buyer' else 'seller' end,
         o.status, o.mode, o.item_id, i.title::text, i.photos[1]::text, i.price, o.offer_rupees, o.delivery_fee_paise,
         (case when o.buyer_id = public.services_account_id() then s.full_name else b.full_name end)::text,
         (case when o.status in ('accepted', 'completed')
               then (case when o.buyer_id = public.services_account_id() then s.phone else b.phone end) end)::text,
         o.note,
         case when o.buyer_id = public.services_account_id() and o.status = 'accepted' then o.code end,
         o.created_at
    from public.services_item_orders o
    join public.services_items i on i.id = o.item_id
    join public.services_signups b on b.id = o.buyer_id
    join public.services_signups s on s.id = o.seller_id
   where public.services_account_id() in (o.buyer_id, o.seller_id)
     and o.created_at > now() - interval '90 days'
   order by o.created_at desc
   limit 60;
$fn$;
revoke all on function public.services_my_item_orders() from public, anon, authenticated;
grant execute on function public.services_my_item_orders() to authenticated;

create or replace function public.services_item_chat_list(p_order uuid)
returns table (id uuid, mine boolean, body text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select m.id, m.sender_id = public.services_account_id(), m.body, m.created_at
    from public.services_item_order_messages m
    join public.services_item_orders o on o.id = m.order_id
   where m.order_id = p_order and public.services_account_id() in (o.buyer_id, o.seller_id)
   order by m.created_at
   limit 200;
$fn$;
revoke all on function public.services_item_chat_list(uuid) from public, anon, authenticated;
grant execute on function public.services_item_chat_list(uuid) to authenticated;

create or replace function public.services_item_chat_send(p_order uuid, p_body text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  o record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('itemchat', v_me::text, 200, 3600);
  if length(btrim(coalesce(p_body, ''))) < 1 then
    return query select false, 'empty'::text;
    return;
  end if;
  select x.* into o from public.services_item_orders x
   where x.id = p_order and v_me in (x.buyer_id, x.seller_id) and x.status in ('requested', 'accepted');
  if not found then
    return query select false, 'closed'::text;
    return;
  end if;
  insert into public.services_item_order_messages (order_id, sender_id, body) values (p_order, v_me, left(btrim(p_body), 300));
  perform public.services_notify(case when v_me = o.buyer_id then o.seller_id else o.buyer_id end, 'item_msg', left(btrim(p_body), 80));
  return query select true, 'sent'::text;
end;
$fn$;
revoke all on function public.services_item_chat_send(uuid, text) from public, anon, authenticated;
grant execute on function public.services_item_chat_send(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select 'part 4 of 4 done' as "149_part4";
