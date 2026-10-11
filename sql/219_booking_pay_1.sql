-- 219_booking_pay_1.sql -- pay for a booked worker, a hired vehicle or an item by
-- wallet, PayU, UPI QR or cash. The worker names the price; the receiver
-- confirms cash/QR money. Part 1 of 3 (then _2 and _3): columns, price, flags.
alter table public.services_bookings add column if not exists price_paise int check (price_paise is null or price_paise between 100 and 50000000);
alter table public.services_bookings add column if not exists paid_online boolean not null default false;
alter table public.services_bookings add column if not exists paid_cash boolean not null default false;
alter table public.services_item_orders add column if not exists paid_cash boolean not null default false;
alter table public.services_payments drop constraint if exists services_payments_purpose_check;
alter table public.services_payments
  add constraint services_payments_purpose_check check (purpose in ('order', 'ride', 'item', 'topup', 'booking'));

create or replace function public.services_booking_set_price(p_id uuid, p_rupees int)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text; return;
  end if;
  if p_rupees is null or p_rupees < 1 or p_rupees > 500000 then
    return query select false, 'bad_amount'::text; return;
  end if;
  update public.services_bookings b set price_paise = p_rupees * 100
    from public.services_workers w
   where b.id = p_id and w.id = b.worker_id and w.user_id = v_me
     and b.status in ('requested', 'accepted', 'completed') and not b.paid_online and not b.paid_cash;
  if not found then
    return query select false, 'not_allowed'::text; return;
  end if;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_booking_set_price(uuid, int) from public, anon;
grant execute on function public.services_booking_set_price(uuid, int) to authenticated;

-- Price, paid or not, how, the receiver's UPI id (for a QR), and which side I am.
create or replace function public.services_pay_flags(p_purpose text, p_ids uuid[])
returns table (id uuid, amount_paise int, paid boolean, via text, upi_id text, other_name text, is_receiver boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if p_purpose = 'booking' then
    return query
      select b.id, b.price_paise, (b.paid_online or b.paid_cash),
             case when b.paid_online then 'online' when b.paid_cash then 'cash' end,
             (select case when p.accepts_upi then p.upi_id end from public.services_biz_payment p where p.account_id = w.user_id),
             coalesce(nullif(btrim(w.business_name), ''), w.full_name)::text, (w.user_id = v_me)
        from public.services_bookings b join public.services_workers w on w.id = b.worker_id
       where b.id = any (p_ids) and (b.customer_id = v_me or w.user_id = v_me);
  elsif p_purpose = 'item' then
    return query
      select i.id, (i.offer_rupees * 100)::int, (i.paid_online or i.paid_cash),
             case when i.paid_online then 'online' when i.paid_cash then 'cash' end,
             (select case when p.accepts_upi then p.upi_id end from public.services_biz_payment p where p.account_id = i.seller_id),
             (select s.full_name::text from public.services_signups s where s.id = i.seller_id), (i.seller_id = v_me)
        from public.services_item_orders i where i.id = any (p_ids) and (i.buyer_id = v_me or i.seller_id = v_me);
  end if;
end;
$fn$;
revoke all on function public.services_pay_flags(text, uuid[]) from public, anon;
grant execute on function public.services_pay_flags(text, uuid[]) to authenticated;

-- The receiver confirms cash or a UPI QR payment arrived.
create or replace function public.services_pay_mark_received(p_purpose text, p_id uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text; return;
  end if;
  if p_purpose = 'booking' then
    update public.services_bookings b set paid_cash = true from public.services_workers w
     where b.id = p_id and w.id = b.worker_id and w.user_id = v_me and b.status in ('accepted', 'completed');
  elsif p_purpose = 'item' then
    update public.services_item_orders set paid_cash = true where id = p_id and seller_id = v_me and status in ('accepted', 'completed');
  else
    return query select false, 'bad_purpose'::text; return;
  end if;
  if not found then
    return query select false, 'not_allowed'::text; return;
  end if;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_pay_mark_received(text, uuid) from public, anon;
grant execute on function public.services_pay_mark_received(text, uuid) to authenticated;
notify pgrst, 'reload schema';
select '219 booking pay part 1 done' as "219_1";
