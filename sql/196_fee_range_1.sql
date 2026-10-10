-- ===========================================================================
-- 196_fee_range_1.sql -- keep the high end of the delivery partner fee on each
-- delivery order (what the customer was shown), and let the customer read the
-- low, current and high figures. The exact fee is set when a rider accepts; for
-- an order paid in advance by UPI, the difference between what was paid (the high
-- end) and the final fee is refunded. Cash on delivery pays only the final fee.
-- Run after 182_delivery_quote.sql and 178_delivery_fee_card.sql.
-- ===========================================================================
alter table public.services_orders add column if not exists delivery_fee_max_paise int not null default 0;

create or replace function public.services_order_charges()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_group text; v_pct numeric := 0; v_card record; q record;
begin
  select t.group_name into v_group from public.services_workers w
    left join public.services_trades t on t.slug = w.trade_slug where w.id = new.worker_id;
  if tg_op = 'INSERT' then
    select g.percent into v_pct from public.services_gst_rates g
     where g.kind = case when v_group = 'Eat & Stay' then 'restaurant' else 'shop' end;
    new.gst_paise := round(new.total_paise * coalesce(v_pct, 0) / 100)::int;
  end if;
  if new.mode = 'delivery' and (new.delivery_fee_paise = 0 or new.delivery_fee_max_paise = 0) then
    select * into q from public.services_delivery_quote(new.worker_id, new.lat, new.lng);
    if new.delivery_fee_paise = 0 then new.delivery_fee_paise := q.fee_paise; end if;
    if new.delivery_fee_max_paise = 0 then new.delivery_fee_max_paise := greatest(q.fee_max_paise, new.delivery_fee_paise); end if;
  end if;
  if new.mode = 'pickup' then
    new.misc_fee_paise := 0; new.misc_gst_paise := 0; new.delivery_fee_max_paise := 0;
  elsif new.misc_fee_paise = 0 then
    select c.platform_rupees, c.gst_percent into v_card from public.services_rate_card c
     where c.key = case when v_group = 'Eat & Stay' then 'delivery_food' else 'delivery_small' end;
    new.misc_fee_paise := coalesce(v_card.platform_rupees, 0) * 100;
    new.misc_gst_paise := round(new.misc_fee_paise * coalesce(v_card.gst_percent, 18) / 100)::int;
  end if;
  new.delivery_gst_paise := 0;
  return new;
end;
$fn$;

create or replace function public.services_order_fee_range(p_orders uuid[])
returns table (order_id uuid, fee_paise int, fee_max_paise int, rider_taken boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select o.id, o.delivery_fee_paise, o.delivery_fee_max_paise,
         coalesce((select j.status in ('accepted', 'picked_up', 'delivered') from public.services_jobs j where j.id = o.job_id), false)
    from public.services_orders o
   where o.id = any (coalesce(p_orders, '{}'::uuid[])) and o.customer_id = public.services_account_id();
$fn$;
revoke all on function public.services_order_fee_range(uuid[]) from public, anon;
grant execute on function public.services_order_fee_range(uuid[]) to authenticated;
notify pgrst, 'reload schema';
select '196 fee range done' as "196";
