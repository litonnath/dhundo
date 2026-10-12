-- 228_hold_release_2.sql -- part 2 of 3: a ride paid online credits the driver when it is done and
-- refunds the passenger if it is cancelled; a booking credits the worker when completed.
create or replace function public.services_ride_money()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_drv uuid;
begin
  if new.status = 'cancelled' then
    perform public.services_refund_payment('ride', new.id);
  elsif new.status = 'done' and new.paid_online and new.fare_paise > 0 then
    select w.user_id into v_drv from public.services_workers w where w.id = new.driver_work;
    if v_drv is not null then
      insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
      values (v_drv, new.fare_paise, 'earning', 'Ride fare', 'ride:' || new.id::text) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_ride_money_trg on public.services_rides;
create trigger services_ride_money_trg after update of status on public.services_rides
  for each row when (old.status is distinct from new.status) execute function public.services_ride_money();

create or replace function public.services_booking_money()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_w uuid;
begin
  if new.paid_online and coalesce(new.price_paise, 0) > 0 then
    select w.user_id into v_w from public.services_workers w where w.id = new.worker_id;
    if v_w is not null then
      insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
      values (v_w, new.price_paise, 'earning', 'Booking payment', 'booking:' || new.id::text) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_booking_money_trg on public.services_bookings;
create trigger services_booking_money_trg after update of status on public.services_bookings
  for each row when (new.status = 'completed' and old.status is distinct from new.status) execute function public.services_booking_money();

-- A cancelled booking takes the worker's earning back only if one was credited.
create or replace function public.services_refund_booking()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare p record; v_acct uuid;
begin
  select * into p from public.services_payments
   where purpose = 'booking' and ref_id = old.id and status = 'paid' and refunded_at is null limit 1 for update;
  if not found then return coalesce(new, old); end if;
  update public.services_payments set refunded_at = now() where id = p.id;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
  values (p.account_id, p.amount_paise, 'refund', 'Refund for a cancelled booking', 'refund:' || p.id::text) on conflict do nothing;
  select w.user_id into v_acct from public.services_workers w where w.id = old.worker_id;
  if v_acct is not null and exists (select 1 from public.services_wallet_entries x where x.kind = 'earning' and x.ref = 'booking:' || old.id::text) then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (v_acct, -p.amount_paise, 'adjustment', 'Booking cancelled: earning taken back', 'reverse:' || p.id::text) on conflict do nothing;
  end if;
  return coalesce(new, old);
end;
$fn$;
select '228 hold release part 2 done' as "228_2";
