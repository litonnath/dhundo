-- 239_popups_3.sql -- part 3 of 3: payment messages. Online (PayU or wallet): the payer sees "Payment successful", the person
-- paid sees "Payment received". Cash or QR confirmed by the rider, worker, seller or shop: "Cash payment confirmed".
create or replace function public.services_popup_paid()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_a uuid; v_b uuid;
begin
  if new.purpose = 'order' then
    select w.user_id into v_a from public.services_orders o join public.services_workers w on w.id = o.worker_id where o.id = new.ref_id;
    select rw.user_id into v_b from public.services_orders o join public.services_jobs j on j.id = o.job_id join public.services_workers rw on rw.id = j.rider_work where o.id = new.ref_id;
  elsif new.purpose = 'ride' then
    select w.user_id into v_a from public.services_rides r join public.services_workers w on w.id = r.driver_work where r.id = new.ref_id;
  elsif new.purpose = 'booking' then
    select w.user_id into v_a from public.services_bookings b join public.services_workers w on w.id = b.worker_id where b.id = new.ref_id;
  elsif new.purpose = 'item' then
    select i.seller_id into v_a from public.services_item_orders i where i.id = new.ref_id;
  end if;
  perform public.services_popup(new.account_id, 'pay_ok', new.amount_paise, new.ref_id);
  perform public.services_popup(v_a, 'pay_in', new.amount_paise, new.ref_id);
  if v_b is not null and v_b is distinct from v_a then perform public.services_popup(v_b, 'pay_in', new.amount_paise, new.ref_id); end if;
  return new;
end;
$fn$;
drop trigger if exists services_popup_payment on public.services_payments;
create trigger services_popup_payment after update of status on public.services_payments
  for each row when (new.status = 'paid' and old.status is distinct from new.status and new.purpose <> 'topup') execute function public.services_popup_paid();

drop trigger if exists services_popup_payment_ins on public.services_payments;
create trigger services_popup_payment_ins after insert on public.services_payments
  for each row when (new.status = 'paid' and new.purpose <> 'topup') execute function public.services_popup_paid();

create or replace function public.services_popup_cash()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_c uuid; v_p uuid; v_amt int;
begin
  if tg_table_name = 'services_rides' then
    v_c := new.passenger_id; v_amt := new.fare_paise;
    select w.user_id into v_p from public.services_workers w where w.id = new.driver_work;
  elsif tg_table_name = 'services_bookings' then
    v_c := new.customer_id; v_amt := new.price_paise;
    select w.user_id into v_p from public.services_workers w where w.id = new.worker_id;
  else
    v_c := new.buyer_id; v_p := new.seller_id; v_amt := (new.offer_rupees * 100)::int;
  end if;
  perform public.services_popup(v_c, 'cash_ok', v_amt, new.id);
  perform public.services_popup(v_p, 'cash_in', v_amt, new.id);
  return new;
end;
$fn$;
drop trigger if exists services_popup_cash_rides on public.services_rides;
create trigger services_popup_cash_rides after update of paid_cash on public.services_rides
  for each row when (new.paid_cash and not old.paid_cash) execute function public.services_popup_cash();
drop trigger if exists services_popup_cash_bookings on public.services_bookings;
create trigger services_popup_cash_bookings after update of paid_cash on public.services_bookings
  for each row when (new.paid_cash and not old.paid_cash) execute function public.services_popup_cash();
drop trigger if exists services_popup_cash_items on public.services_item_orders;
create trigger services_popup_cash_items after update of paid_cash on public.services_item_orders
  for each row when (new.paid_cash and not old.paid_cash) execute function public.services_popup_cash();
select '239_3 done' as "239_3";
