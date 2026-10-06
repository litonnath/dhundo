-- 145 part 1: a third way to get an order: the shop delivers it itself, for a
-- charge the shop sets (for things too big for a bike). Orders get a new mode
-- shop_delivery and two new statuses: confirmed (the shop accepted the order and
-- will name a delivery charge by distance) and quoted (the charge is named and
-- waits for the customer to accept).
do $$
declare r record;
begin
  for r in select c.conname from pg_constraint c
            where c.conrelid = 'public.services_orders'::regclass and c.contype = 'c'
              and (pg_get_constraintdef(c.oid) like '%mode%' or pg_get_constraintdef(c.oid) like '%status%')
  loop
    execute format('alter table public.services_orders drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.services_orders add constraint services_orders_mode_chk
  check (mode in ('delivery', 'pickup', 'shop_delivery'));
alter table public.services_orders add constraint services_orders_status_chk
  check (status in ('placed', 'confirmed', 'quoted', 'accepted', 'ready', 'delivered', 'rejected', 'cancelled'));

create or replace function public.services_trg_order_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if new.status is distinct from old.status and new.status in ('confirmed', 'quoted', 'accepted', 'ready', 'delivered', 'rejected') then
    perform public.services_notify(new.customer_id,
      case when new.status = 'quoted' and new.mode = 'pickup' then 'order_nodelivery' else 'order_' || new.status end, null);
  end if;
  if new.status is distinct from old.status and new.status = 'accepted' and new.mode = 'shop_delivery' then
    perform public.services_notify((select w.user_id from public.services_workers w where w.id = new.worker_id), 'order_quote_ok', null);
  end if;
  return new;
end;
$fn$;
notify pgrst, 'reload schema';
select 'part 1 of 3 done' as "145_part1";
