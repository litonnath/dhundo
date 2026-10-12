-- 238_block_while_due.sql -- a customer who has a finished ride or a completed booking that is not paid yet cannot book
-- another ride, booking, order or item until it is paid (online, or the rider / worker confirms the cash).
create or replace function public.services_has_due(p_acct uuid)
returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select exists (select 1 from public.services_rides r where r.passenger_id = p_acct and r.status = 'done'
                  and coalesce(r.fare_paise, 0) >= 100 and not (r.paid_online or r.paid_cash) and r.done_at > now() - interval '30 days')
      or exists (select 1 from public.services_bookings b where b.customer_id = p_acct and b.status = 'completed'
                  and coalesce(b.price_paise, 0) >= 100 and not (b.paid_online or b.paid_cash) and b.closed_at > now() - interval '30 days')
$fn$;
revoke all on function public.services_has_due(uuid) from public, anon, authenticated;

create or replace function public.services_block_while_due()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_acct uuid := coalesce(to_jsonb(new) ->> 'passenger_id', to_jsonb(new) ->> 'customer_id', to_jsonb(new) ->> 'buyer_id')::uuid;
begin
  if v_acct is not null and public.services_has_due(v_acct) then
    raise exception 'payment_due' using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_due_block_rides on public.services_rides;
create trigger services_due_block_rides before insert on public.services_rides for each row execute function public.services_block_while_due();
drop trigger if exists services_due_block_bookings on public.services_bookings;
create trigger services_due_block_bookings before insert on public.services_bookings for each row execute function public.services_block_while_due();
drop trigger if exists services_due_block_orders on public.services_orders;
create trigger services_due_block_orders before insert on public.services_orders for each row execute function public.services_block_while_due();
drop trigger if exists services_due_block_items on public.services_item_orders;
create trigger services_due_block_items before insert on public.services_item_orders for each row execute function public.services_block_while_due();
select '238 block while due done' as "238";
