-- 225_fee_in_pay_5.sql -- part 5 of 6: when a rider accepts, refund the fee difference; when the
-- order is delivered, credit the rider (paid online) or settle the cash the collector holds (cash on delivery).
-- Cash on delivery: the collector (the rider on a delivery, else the shop) keeps the cash. The shop is
-- credited its items; the collector's wallet is debited what is owed to the shop and Dhundo (his own fee excluded).
create or replace function public.services_order_fee_after()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  perform public.services_order_fee_settle(new.id);
  return new;
end;
$fn$;
drop trigger if exists services_order_fee_after_trg on public.services_orders;
create trigger services_order_fee_after_trg after update of delivery_fee_paise on public.services_orders
  for each row when (old.delivery_fee_paise is distinct from new.delivery_fee_paise) execute function public.services_order_fee_after();

create or replace function public.services_order_delivered_ledger()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_shop uuid; v_rider uuid; v_dh bigint; v_cash_rider boolean;
begin
  if not new.ledger or new.status <> 'delivered' or old.status = 'delivered' then return new; end if;
  select w.user_id into v_shop from public.services_workers w where w.id = new.worker_id;
  select rw.user_id into v_rider from public.services_jobs j join public.services_workers rw on rw.id = j.rider_work where j.id = new.job_id;
  v_dh := new.gst_paise + new.delivery_gst_paise + new.misc_fee_paise + new.misc_gst_paise + new.cod_fee_paise;
  if new.pay_method = 'cod' then
    v_cash_rider := new.mode = 'delivery' and v_rider is not null;
    if v_cash_rider then
      insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
      values (v_shop, new.total_paise, 'earning', 'Order paid in cash to the rider', 'order:' || new.id::text) on conflict do nothing;
      insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
      values (v_rider, -(new.total_paise + v_dh), 'settlement', 'Cash collected: shop and Dhundo share', 'cash:' || new.id::text) on conflict do nothing;
    elsif v_dh > 0 then
      insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
      values (v_shop, -v_dh, 'settlement', 'Cash collected: Dhundo share', 'cash:' || new.id::text) on conflict do nothing;
    end if;
  elsif new.fee_prepaid_paise > 0 and v_rider is not null and new.delivery_fee_paise > 0 then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (v_rider, new.delivery_fee_paise, 'earning', 'Delivery partner fee', 'ridefee:' || new.id::text) on conflict do nothing;
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_order_delivered_ledger_trg on public.services_orders;
create trigger services_order_delivered_ledger_trg after update of status on public.services_orders
  for each row execute function public.services_order_delivered_ledger();
select '225 fee in pay part 5 done' as "225_5";
