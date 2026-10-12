-- 239_popups_2.sql -- part 2 of 3: the completion messages (ride done, order delivered, booking completed).
create or replace function public.services_popup_done()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_a uuid; v_b uuid;
begin
  if tg_table_name = 'services_rides' then
    select w.user_id into v_a from public.services_workers w where w.id = new.driver_work;
    perform public.services_popup(new.passenger_id, 'ride_done_c', null, new.id);
    perform public.services_popup(v_a, 'ride_done_p', null, new.id);
  elsif tg_table_name = 'services_orders' then
    select w.user_id into v_a from public.services_workers w where w.id = new.worker_id;
    select rw.user_id into v_b from public.services_jobs j join public.services_workers rw on rw.id = j.rider_work where j.id = new.job_id;
    perform public.services_popup(new.customer_id, 'order_done_c', null, new.id);
    perform public.services_popup(v_a, 'order_done_p', null, new.id);
    if v_b is not null and v_b is distinct from v_a then perform public.services_popup(v_b, 'order_done_p', null, new.id); end if;
  elsif tg_table_name = 'services_bookings' then
    select w.user_id into v_a from public.services_workers w where w.id = new.worker_id;
    perform public.services_popup(new.customer_id, 'booking_done_c', null, new.id);
    perform public.services_popup(v_a, 'booking_done_p', null, new.id);
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_popup_ride_done on public.services_rides;
create trigger services_popup_ride_done after update of status on public.services_rides
  for each row when (new.status = 'done' and old.status is distinct from new.status) execute function public.services_popup_done();
drop trigger if exists services_popup_order_done on public.services_orders;
create trigger services_popup_order_done after update of status on public.services_orders
  for each row when (new.status = 'delivered' and old.status is distinct from new.status) execute function public.services_popup_done();
drop trigger if exists services_popup_booking_done on public.services_bookings;
create trigger services_popup_booking_done after update of status on public.services_bookings
  for each row when (new.status = 'completed' and old.status is distinct from new.status) execute function public.services_popup_done();
select '239_2 done' as "239_2";
