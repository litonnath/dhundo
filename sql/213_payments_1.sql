-- ===========================================================================
-- 213_payments_1.sql -- online payment through a gateway (PayU: UPI, cards). Part 1
-- of 2: the payments ledger, and the check of what a person may pay for and
-- how much. The amount is always worked out here, from the order, ride or
-- item itself, never taken from the phone. Run 213_payments_2.sql next.
-- ===========================================================================
create table if not exists public.services_payments (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.services_signups(id) on delete cascade,
  purpose       text not null check (purpose in ('order', 'ride', 'item')),
  ref_id        uuid not null,
  amount_paise  int not null check (amount_paise between 100 and 50000000),
  rp_order_id   text not null unique, -- the gateway transaction id (PayU txnid)
  rp_payment_id text,               -- the gateway payment id (PayU mihpayid)
  status        text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);
create index if not exists services_payments_ref on public.services_payments (purpose, ref_id);
create index if not exists services_payments_acc on public.services_payments (account_id, created_at desc);
alter table public.services_payments enable row level security;
revoke all on public.services_payments from public, anon, authenticated;

create or replace function public.services_payment_prepare(p_purpose text, p_ref uuid)
returns table (ok boolean, reason text, amount_paise int, account_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  o record;
  r record;
  i record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text, 0, null::uuid;
    return;
  end if;
  perform public.services_rate_guard('pay_prepare', v_me::text, 40, 3600);
  if p_purpose = 'order' then
    select x.* into o from public.services_orders x where x.id = p_ref and x.customer_id = v_me;
    if not found or o.status in ('rejected', 'cancelled') or o.paid then
      return query select false, 'not_payable'::text, 0, null::uuid;
      return;
    end if;
    -- items, GST and Dhundo's fee. The delivery partner fee goes straight to the rider.
    return query select true, 'ok'::text,
      (o.total_paise + o.gst_paise + o.delivery_gst_paise + o.misc_fee_paise + o.misc_gst_paise)::int, v_me;
  elsif p_purpose = 'ride' then
    select x.* into r from public.services_rides x where x.id = p_ref and x.passenger_id = v_me;
    if not found or r.status not in ('accepted', 'done') or coalesce(r.fare_paise, 0) < 100 then
      return query select false, 'not_payable'::text, 0, null::uuid;
      return;
    end if;
    return query select true, 'ok'::text, r.fare_paise::int, v_me;
  elsif p_purpose = 'item' then
    select x.* into i from public.services_item_orders x where x.id = p_ref and x.buyer_id = v_me;
    if not found or i.status not in ('requested', 'accepted') or i.offer_rupees < 1 then
      return query select false, 'not_payable'::text, 0, null::uuid;
      return;
    end if;
    return query select true, 'ok'::text, (i.offer_rupees * 100)::int, v_me;
  else
    return query select false, 'bad_purpose'::text, 0, null::uuid;
  end if;
end;
$fn$;
revoke all on function public.services_payment_prepare(text, uuid) from public, anon;
grant execute on function public.services_payment_prepare(text, uuid) to authenticated;

create or replace function public.services_payment_status(p_purpose text, p_ref uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select coalesce((select 'paid' from public.services_payments p
                    where p.purpose = p_purpose and p.ref_id = p_ref and p.status = 'paid'
                      and p.account_id = public.services_account_id() limit 1), 'unpaid');
$fn$;
revoke all on function public.services_payment_status(text, uuid) from public, anon;
grant execute on function public.services_payment_status(text, uuid) to authenticated;
notify pgrst, 'reload schema';
select '213 payments part 1 done' as "213_1";
