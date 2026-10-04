-- ===========================================================================
-- 118_part4.sql -- the customer hears when an order changes.
-- ===========================================================================
create or replace function public.services_trg_order_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if new.status is distinct from old.status and new.status in ('accepted', 'ready', 'delivered', 'rejected') then
    perform public.services_notify(new.customer_id, 'order_' || new.status, null);
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_order_status on public.services_orders;
create trigger services_order_status after update on public.services_orders
  for each row execute function public.services_trg_order_status();

select 'part 4 of 6 done' as "118_part4";
