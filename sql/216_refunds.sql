-- ===========================================================================
-- 216_refunds.sql -- when an order or an item that was paid online is
-- cancelled or declined, the money goes back to the payer's wallet, and the
-- partner's earning for it is taken back. Done by a trigger, once per payment.
-- Run after 215_wallet_2.sql.
-- ===========================================================================
alter table public.services_payments add column if not exists refunded_at timestamptz;
create unique index if not exists services_wallet_one_refund on public.services_wallet_entries (ref) where kind = 'refund';
create unique index if not exists services_wallet_one_reversal on public.services_wallet_entries (ref) where kind = 'adjustment' and ref is not null;

create or replace function public.services_refund_payment(p_purpose text, p_ref uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  p record;
  v_acct uuid;
  v_amt bigint;
begin
  select * into p from public.services_payments
   where purpose = p_purpose and ref_id = p_ref and status = 'paid' and refunded_at is null
   order by paid_at desc limit 1 for update;
  if not found then return; end if;
  update public.services_payments set refunded_at = now() where id = p.id;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
  values (p.account_id, p.amount_paise, 'refund', 'Refund for a cancelled ' || p_purpose, 'refund:' || p.id::text) on conflict do nothing;
  if p_purpose = 'order' then
    select w.user_id, o.total_paise into v_acct, v_amt
      from public.services_orders o join public.services_workers w on w.id = o.worker_id where o.id = p_ref;
  elsif p_purpose = 'item' then
    select i.seller_id, (i.offer_rupees * 100)::bigint into v_acct, v_amt from public.services_item_orders i where i.id = p_ref;
  end if;
  if v_acct is not null and coalesce(v_amt, 0) > 0 then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (v_acct, -v_amt, 'adjustment', 'Order cancelled: earning taken back', 'reverse:' || p.id::text) on conflict do nothing;
  end if;
end;
$fn$;
revoke all on function public.services_refund_payment(text, uuid) from public, anon, authenticated;

create or replace function public.services_refund_on_order()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if new.status in ('cancelled', 'rejected') and old.status is distinct from new.status then
    perform public.services_refund_payment('order', new.id);
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_refund_order_trg on public.services_orders;
create trigger services_refund_order_trg after update of status on public.services_orders
  for each row execute function public.services_refund_on_order();

create or replace function public.services_refund_on_item()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if new.status in ('cancelled', 'declined') and old.status is distinct from new.status then
    perform public.services_refund_payment('item', new.id);
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_refund_item_trg on public.services_item_orders;
create trigger services_refund_item_trg after update of status on public.services_item_orders
  for each row execute function public.services_refund_on_item();
notify pgrst, 'reload schema';
select '216 refunds done' as "216";
