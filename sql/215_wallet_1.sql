-- ===========================================================================
-- 215_wallet_1.sql -- the Dhundo wallet is a real balance. People add money
-- (PayU), pay for orders, rides and items from it, partners' earnings arrive in
-- it, and they withdraw to UPI. Part 1 of 2: top-up as a payment kind, and one
-- place that works out what something costs. Run 215_wallet_2.sql next.
-- Needs 213 and 214.
-- ===========================================================================
alter table public.services_payments drop constraint if exists services_payments_purpose_check;
alter table public.services_payments
  add constraint services_payments_purpose_check check (purpose in ('order', 'ride', 'item', 'topup'));
alter table public.services_wallet_entries drop constraint if exists services_wallet_kind_known;
alter table public.services_wallet_entries
  add constraint services_wallet_kind_known
  check (kind in ('signup_bonus', 'promo', 'adjustment', 'refund', 'referral', 'listing_bonus', 'withdrawal', 'earning', 'topup', 'spend'));
create unique index if not exists services_wallet_one_spend on public.services_wallet_entries (ref) where kind = 'spend';

-- What this person owes for an order, a ride or an item, in paise.
create or replace function public.services_payment_amount(p_me uuid, p_purpose text, p_ref uuid)
returns table (ok boolean, reason text, amount_paise int)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  o record;
  r record;
  i record;
begin
  if p_purpose = 'order' then
    select x.* into o from public.services_orders x where x.id = p_ref and x.customer_id = p_me;
    if not found or o.status in ('rejected', 'cancelled') or o.paid then
      return query select false, 'not_payable'::text, 0; return;
    end if;
    -- items, GST and Dhundo's fee. The delivery partner fee goes straight to the rider.
    return query select true, 'ok'::text,
      (o.total_paise + o.gst_paise + o.delivery_gst_paise + o.misc_fee_paise + o.misc_gst_paise)::int;
  elsif p_purpose = 'ride' then
    select x.* into r from public.services_rides x where x.id = p_ref and x.passenger_id = p_me;
    if not found or r.status not in ('accepted', 'done') or coalesce(r.fare_paise, 0) < 100 or r.paid_online then
      return query select false, 'not_payable'::text, 0; return;
    end if;
    return query select true, 'ok'::text, r.fare_paise::int;
  elsif p_purpose = 'item' then
    select x.* into i from public.services_item_orders x where x.id = p_ref and x.buyer_id = p_me;
    if not found or i.status not in ('requested', 'accepted') or i.offer_rupees < 1 or i.paid_online then
      return query select false, 'not_payable'::text, 0; return;
    end if;
    return query select true, 'ok'::text, (i.offer_rupees * 100)::int;
  else
    return query select false, 'bad_purpose'::text, 0;
  end if;
end;
$fn$;
revoke all on function public.services_payment_amount(uuid, text, uuid) from public, anon, authenticated;

drop function if exists public.services_payment_prepare(text, uuid);
drop function if exists public.services_payment_prepare(text, uuid, int);
create function public.services_payment_prepare(p_purpose text, p_ref uuid, p_amount_rupees int default null)
returns table (ok boolean, reason text, amount_paise int, account_id uuid, ref_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  a record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text, 0, null::uuid, null::uuid; return;
  end if;
  perform public.services_rate_guard('pay_prepare', v_me::text, 40, 3600);
  if p_purpose = 'topup' then
    if p_amount_rupees is null or p_amount_rupees < 10 or p_amount_rupees > 50000 then
      return query select false, 'bad_amount'::text, 0, null::uuid, null::uuid; return;
    end if;
    return query select true, 'ok'::text, p_amount_rupees * 100, v_me, gen_random_uuid(); return;
  end if;
  select * into a from public.services_payment_amount(v_me, p_purpose, p_ref);
  if not a.ok then
    return query select false, a.reason, 0, null::uuid, null::uuid; return;
  end if;
  return query select true, 'ok'::text, a.amount_paise, v_me, p_ref;
end;
$fn$;
revoke all on function public.services_payment_prepare(text, uuid, int) from public, anon;
grant execute on function public.services_payment_prepare(text, uuid, int) to authenticated;
notify pgrst, 'reload schema';
select '215 wallet part 1 done' as "215_1";
