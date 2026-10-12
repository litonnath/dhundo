-- 230_refund_queue_3.sql -- part 3 of 3: the admin list and the decision. Paid work that was never
-- finished also raises a request when the list is opened: an item not handed over in 7 days, an order
-- or a ride not finished in 2 days.
create or replace function public.services_admin_refund_requests(p_status text default 'pending')
returns table (id uuid, purpose text, amount_paise int, reason text, status text, name text, phone text, created_at timestamptz)
language plpgsql security definer set search_path to 'public' as $fn$
begin
  if not public.services_is_admin() then raise exception 'not_admin' using errcode = 'PT403'; end if;
  perform public.services_refund_request('item', i.id, 'Item not handed over in 7 days')
    from public.services_item_orders i join public.services_payments p on p.purpose = 'item' and p.ref_id = i.id and p.status = 'paid' and p.refunded_at is null
   where i.status in ('requested', 'accepted') and p.paid_at < now() - interval '7 days';
  perform public.services_refund_request('order', o.id, 'Order not delivered in 2 days')
    from public.services_orders o join public.services_payments p on p.purpose = 'order' and p.ref_id = o.id and p.status = 'paid' and p.refunded_at is null
   where o.status not in ('delivered', 'cancelled', 'rejected') and p.paid_at < now() - interval '2 days';
  perform public.services_refund_request('ride', r.id, 'Ride not finished in 2 days')
    from public.services_rides r join public.services_payments p on p.purpose = 'ride' and p.ref_id = r.id and p.status = 'paid' and p.refunded_at is null
   where r.status not in ('done', 'cancelled') and p.paid_at < now() - interval '2 days';
  return query
    select q.id, q.purpose, q.amount_paise, q.reason, q.status, s.full_name::text, s.phone::text, q.created_at
      from public.services_refund_requests q join public.services_signups s on s.id = q.account_id
     where p_status is null or q.status = p_status order by q.created_at desc limit 200;
end;
$fn$;
revoke all on function public.services_admin_refund_requests(text) from public, anon;
grant execute on function public.services_admin_refund_requests(text) to authenticated;

create or replace function public.services_admin_refund_decide(p_id uuid, p_approve boolean)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path to 'public' as $fn$
begin
  if not public.services_is_admin() then raise exception 'not_admin' using errcode = 'PT403'; end if;
  if p_approve then
    if not public.services_refund_apply(p_id) then return query select false, 'not_pending'::text; return; end if;
    update public.services_refund_requests set status = 'approved', decided_at = now(), decided_by = public.services_account_id() where id = p_id;
  else
    update public.services_refund_requests set status = 'rejected', decided_at = now(), decided_by = public.services_account_id()
     where id = p_id and status = 'pending';
    if not found then return query select false, 'not_pending'::text; return; end if;
  end if;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_admin_refund_decide(uuid, boolean) from public, anon;
grant execute on function public.services_admin_refund_decide(uuid, boolean) to authenticated;
notify pgrst, 'reload schema';
select '230 refund queue part 3 done' as "230_3";
