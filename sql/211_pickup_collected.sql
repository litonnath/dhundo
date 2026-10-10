-- ===========================================================================
-- 211_pickup_collected.sql -- a self-pickup order that the shop marks as
-- collected is recorded as collected by the customer: collected_at is stamped
-- (status stays 'delivered' so every existing report keeps working).
-- ===========================================================================
alter table public.services_orders add column if not exists collected_at timestamptz;

create or replace function public.services_order_collected_stamp()
returns trigger
language plpgsql
as $fn$
begin
  if new.status = 'delivered' and new.mode = 'pickup'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.collected_at := now();
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_order_collected_trg on public.services_orders;
create trigger services_order_collected_trg before insert or update of status on public.services_orders
  for each row execute function public.services_order_collected_stamp();

update public.services_orders set collected_at = coalesce(updated_at, created_at)
 where status = 'delivered' and mode = 'pickup' and collected_at is null;
notify pgrst, 'reload schema';
select '211 pickup collected done' as "211";
