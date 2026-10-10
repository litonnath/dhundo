-- ===========================================================================
-- 177_admin_orders_split.sql -- the admin order list also shows who gets what
-- on each order: the shop (items plus any delivery charge left after the
-- rider), the rider (the delivery job fee), Dhundo (the miscellaneous fee) and
-- the GST collected for the government. Replaces services_admin_orders from 167.
-- Run after 167_admin_console_1.sql.
-- ===========================================================================
drop function if exists public.services_admin_orders(text, int);
create function public.services_admin_orders(p_status text default null, p_limit int default 100)
returns table (id uuid, created_at timestamptz, status text, mode text,
               shop text, customer text, customer_phone text,
               total_paise int, charges_paise int,
               paid boolean, pay_method text,
               shop_gets_paise int, rider_gets_paise int, platform_gets_paise int, gst_paise int)
language plpgsql stable security definer set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  return query
    select o.id, o.created_at, o.status::text, o.mode::text,
           coalesce(nullif(btrim(w.business_name), ''), w.full_name)::text,
           c.full_name::text, c.phone::text, o.total_paise,
           (o.gst_paise + o.delivery_fee_paise + o.delivery_gst_paise + o.misc_fee_paise + o.misc_gst_paise)::int,
           o.paid, o.pay_method::text,
           o.total_paise::int,
           o.delivery_fee_paise::int,
           o.misc_fee_paise::int,
           (o.gst_paise + o.delivery_gst_paise + o.misc_gst_paise)::int
      from public.services_orders o
      join public.services_workers w on w.id = o.worker_id
      join public.services_signups c on c.id = o.customer_id
      left join public.services_jobs j on j.id = o.job_id
     where p_status is null or o.status = p_status
     order by o.created_at desc
     limit least(greatest(coalesce(p_limit, 100), 1), 300);
end;
$fn$;
revoke all on function public.services_admin_orders(text, int) from public, anon;
grant execute on function public.services_admin_orders(text, int) to authenticated;
notify pgrst, 'reload schema';
select '177 admin orders split done' as "177";
