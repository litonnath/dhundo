-- 224_online_first_1.sql -- pay first, then the restaurant sees the order. Part 1 of 5.
-- An order paid online is held (pay_hold) until the payment succeeds; the shop
-- is told only then. Cash on delivery adds Rs 30 (cod_fee_paise) on delivery orders.
-- Run 224_online_first_2 .. _5 after this. Needs 164, 215 and 219.
alter table public.services_orders add column if not exists pay_hold boolean not null default false;
alter table public.services_orders add column if not exists cod_fee_paise int not null default 0;

create or replace function public.services_cod_fee_paise() returns int language sql immutable as $$ select 3000 $$;

create or replace function public.services_order_cod_fee()
returns trigger language plpgsql set search_path to 'public' as $fn$
begin
  new.cod_fee_paise := case when new.pay_method = 'cod' and new.mode <> 'pickup' and not new.paid
                            then public.services_cod_fee_paise() else 0 end;
  return new;
end;
$fn$;
drop trigger if exists services_order_cod_fee_trg on public.services_orders;
create trigger services_order_cod_fee_trg before insert or update of pay_method, mode on public.services_orders
  for each row execute function public.services_order_cod_fee();

-- The shop hears about an order when it is placed, or when its payment succeeds.
create or replace function public.services_trg_order_new()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if tg_op = 'INSERT' and new.pay_hold then return new; end if;
  if tg_op = 'UPDATE' and not (old.pay_hold and not new.pay_hold) then return new; end if;
  perform public.services_notify(
    (select w.user_id from public.services_workers w where w.id = new.worker_id),
    'order_new', (new.total_paise / 100)::text);
  return new;
end;
$fn$;
drop trigger if exists services_order_released on public.services_orders;
create trigger services_order_released after update of pay_hold on public.services_orders
  for each row execute function public.services_trg_order_new();
select '224 online first part 1 done' as "224_1";
