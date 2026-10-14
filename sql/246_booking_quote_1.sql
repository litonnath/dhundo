-- 246 part 1 of 2: the provider names the price BEFORE accepting a booking; the customer must agree.
-- Scheduled rides already carry their fare, so they count as agreed. Run 246_booking_quote_2.sql next.
alter table public.services_bookings add column if not exists price_ok boolean not null default false;
-- bookings already underway or finished with a price keep it; scheduled rides are agreed by their fare
update public.services_bookings set price_ok = true
 where (status <> 'requested' and price_paise is not null) or coalesce(note, '') like 'Scheduled rides.%';

create or replace function public.services_booking_plan_agreed()
returns trigger language plpgsql set search_path to 'public' as $t$
begin
  if coalesce(new.note, '') like 'Scheduled rides.%' then new.price_ok := true; end if;
  return new;
end;
$t$;
drop trigger if exists services_booking_plan_agreed_trg on public.services_bookings;
create trigger services_booking_plan_agreed_trg before insert on public.services_bookings
  for each row execute function public.services_booking_plan_agreed();

create or replace function public.services_booking_set_price(p_id uuid, p_rupees int)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text; return;
  end if;
  if p_rupees is null or p_rupees < 1 or p_rupees > 500000 then
    return query select false, 'bad_amount'::text; return;
  end if;
  -- a new price while the booking is still a request has to be agreed by the customer again;
  -- once agreed, the price is final (it can be set later only if none was ever agreed)
  update public.services_bookings b
     set price_paise = p_rupees * 100,
         price_ok = case when b.status = 'requested' then false else b.price_ok end
    from public.services_workers w
   where b.id = p_id and w.id = b.worker_id and w.user_id = v_me
     and not b.paid_online and not b.paid_cash
     and (b.status = 'requested' or (b.status in ('accepted', 'completed') and not b.price_ok));
  if not found then
    return query select false, 'not_allowed'::text; return;
  end if;
  perform public.services_notify(b.customer_id, 'booking_quoted', p_rupees::text)
     from public.services_bookings b where b.id = p_id and b.status = 'requested';
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_booking_set_price(uuid, int) from public, anon;
grant execute on function public.services_booking_set_price(uuid, int) to authenticated;
notify pgrst, 'reload schema';
select '246 part 1 of 2 done' as "246_1";
