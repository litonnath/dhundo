-- ===========================================================================
-- 214_earnings.sql -- what a partner earns from an online payment goes into
-- their wallet, from where they can withdraw to their UPI id (the withdraw
-- request, the 24 hour hold on a new UPI id and the admin payout list already
-- exist). A shop earns the items of an order; a driver earns the ride fare; a
-- seller earns the item price. Dhundo's delivery fee and the GST stay with
-- Dhundo, and the delivery partner fee is paid by the customer straight to the
-- rider. Run after 213_payments_2.sql and 103/156.
-- ===========================================================================
alter table public.services_wallet_entries drop constraint if exists services_wallet_kind_known;
alter table public.services_wallet_entries
  add constraint services_wallet_kind_known
  check (kind in ('signup_bonus', 'promo', 'adjustment', 'refund', 'referral', 'listing_bonus', 'withdrawal', 'earning'));
alter table public.services_wallet_entries add column if not exists ref text;
create unique index if not exists services_wallet_one_earning on public.services_wallet_entries (ref) where kind = 'earning';

create or replace function public.services_payment_mark_paid(p_rp_order text, p_rp_payment text, p_amount int)
returns text
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  p record;
  v_acct uuid;
  v_amt bigint := 0;
  v_note text;
begin
  select * into p from public.services_payments where rp_order_id = p_rp_order for update;
  if not found then return 'unknown_order'; end if;
  if p.status = 'paid' then return 'already'; end if;
  if p_amount is not null and p_amount <> p.amount_paise then return 'amount_mismatch'; end if;
  update public.services_payments set status = 'paid', rp_payment_id = p_rp_payment, paid_at = now() where id = p.id;
  if p.purpose = 'order' then
    update public.services_orders set paid = true, paid_at = now(), pay_method = 'upi', updated_at = updated_at where id = p.ref_id;
    select w.user_id, o.total_paise into v_acct, v_amt
      from public.services_orders o join public.services_workers w on w.id = o.worker_id where o.id = p.ref_id;
    v_note := 'Order payment';
  elsif p.purpose = 'ride' then
    update public.services_rides set paid_online = true where id = p.ref_id;
    select w.user_id, r.fare_paise into v_acct, v_amt
      from public.services_rides r join public.services_workers w on w.id = r.driver_work where r.id = p.ref_id;
    v_note := 'Ride fare';
  elsif p.purpose = 'item' then
    update public.services_item_orders set paid_online = true where id = p.ref_id;
    select i.seller_id, (i.offer_rupees * 100)::bigint into v_acct, v_amt from public.services_item_orders i where i.id = p.ref_id;
    v_note := 'Item sale';
  end if;
  if v_acct is not null and coalesce(v_amt, 0) > 0 then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (v_acct, v_amt, 'earning', v_note, p.purpose || ':' || p.ref_id::text)
    on conflict do nothing;
  end if;
  return 'paid';
end;
$fn$;
revoke all on function public.services_payment_mark_paid(text, text, int) from public, anon, authenticated;
grant execute on function public.services_payment_mark_paid(text, text, int) to service_role;
notify pgrst, 'reload schema';
select '214 earnings done' as "214";
