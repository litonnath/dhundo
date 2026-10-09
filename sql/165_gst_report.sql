-- ===========================================================================
-- 165_gst_report.sql -- run after 164_orders_gst.sql. Admin only: the GST and fee totals on
-- delivered orders in a date range, month by month, for your accountant and
-- GST returns. Amounts are in paise.
-- ===========================================================================
create or replace function public.services_admin_gst_report(p_from date, p_to date)
returns table (month text, orders bigint, items_paise bigint,
               items_gst_restaurant_paise bigint, items_gst_shop_paise bigint,
               delivery_paise bigint, delivery_gst_paise bigint,
               misc_fee_paise bigint, misc_gst_paise bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  return query
    select to_char(o.created_at at time zone 'Asia/Kolkata', 'YYYY-MM'),
           count(*),
           coalesce(sum(o.total_paise), 0)::bigint,
           coalesce(sum(o.gst_paise) filter (where t.group_name = 'Eat & Stay'), 0)::bigint,
           coalesce(sum(o.gst_paise) filter (where t.group_name is distinct from 'Eat & Stay'), 0)::bigint,
           coalesce(sum(o.delivery_fee_paise), 0)::bigint,
           coalesce(sum(o.delivery_gst_paise), 0)::bigint,
           coalesce(sum(o.misc_fee_paise), 0)::bigint,
           coalesce(sum(o.misc_gst_paise), 0)::bigint
      from public.services_orders o
      join public.services_workers w on w.id = o.worker_id
      left join public.services_trades t on t.slug = w.trade_slug
     where o.status = 'delivered'
       and (o.created_at at time zone 'Asia/Kolkata')::date between coalesce(p_from, date '2000-01-01') and coalesce(p_to, current_date)
     group by 1
     order by 1 desc;
end;
$fn$;
revoke all on function public.services_admin_gst_report(date, date) from public, anon;
grant execute on function public.services_admin_gst_report(date, date) to authenticated;
notify pgrst, 'reload schema';
select '165 gst report done' as "165";
