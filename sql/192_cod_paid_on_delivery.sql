-- ===========================================================================
-- 192_cod_paid_on_delivery.sql -- a cash on delivery order that has been delivered
-- has been paid in cash, so it is marked paid at that moment. A UPI order stays
-- unpaid until the shop confirms it. Orders delivered earlier are caught up once.
-- Run after 164_order_charges.sql and 176_order_payment.sql.
-- ===========================================================================
create or replace function public.services_order_cod_paid()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if new.status = 'delivered' and new.pay_method = 'cod' and not new.paid then
    new.paid := true;
    new.paid_at := now();
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_order_cod_paid_trg on public.services_orders;
create trigger services_order_cod_paid_trg
  before update of status on public.services_orders
  for each row execute function public.services_order_cod_paid();

update public.services_orders set paid = true, paid_at = coalesce(paid_at, updated_at)
 where status = 'delivered' and pay_method = 'cod' and not paid;
notify pgrst, 'reload schema';
select '192 cod paid on delivery done' as "192";
