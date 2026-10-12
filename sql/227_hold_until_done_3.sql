-- 227_hold_until_done_3.sql -- part 3 of 3: on delivery, an order paid online credits the shop and the rider.
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
  elsif exists (select 1 from public.services_payments p where p.purpose = 'order' and p.ref_id = new.id and p.status = 'paid' and p.refunded_at is null) then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (v_shop, new.total_paise, 'earning', 'Order payment', 'order:' || new.id::text) on conflict do nothing;
    if new.fee_prepaid_paise > 0 and v_rider is not null and new.delivery_fee_paise > 0 then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (v_rider, new.delivery_fee_paise, 'earning', 'Delivery partner fee', 'ridefee:' || new.id::text) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_order_delivered_ledger_trg on public.services_orders;
create trigger services_order_delivered_ledger_trg after update of status on public.services_orders
  for each row execute function public.services_order_delivered_ledger();
select '227 hold part 3 done' as "227_3";
