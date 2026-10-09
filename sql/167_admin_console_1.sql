-- ===========================================================================
-- 167_admin_console_1.sql -- admin-only read functions for the admin console:
-- the overview numbers and the orders list. Amounts in paise.
-- ===========================================================================
create or replace function public.services_admin_overview()
returns table (users bigint, partners_live bigint, partners_pending bigint,
               orders_today bigint, orders_active bigint, orders_30d bigint,
               sales_30d_paise bigint, rides_today bigint, rides_30d bigint,
               jobs_open bigint, withdrawals_pending bigint,
               misc_fee_30d_paise bigint, gst_30d_paise bigint)
language plpgsql stable security definer set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  return query select
    (select count(*) from public.services_signups),
    (select count(*) from public.services_workers where status = 'approved'),
    (select count(*) from public.services_workers where status = 'pending'),
    (select count(*) from public.services_orders where created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'),
    (select count(*) from public.services_orders where status in ('placed','confirmed','quoted','accepted','ready')),
    (select count(*) from public.services_orders where created_at >= now() - interval '30 days'),
    (select coalesce(sum(total_paise), 0) from public.services_orders where status = 'delivered' and created_at >= now() - interval '30 days'),
    (select count(*) from public.services_rides where created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'),
    (select count(*) from public.services_rides where created_at >= now() - interval '30 days'),
    (select count(*) from public.services_jobs where status = 'open' and expires_at > now()),
    (select count(*) from public.services_withdrawals where status = 'requested'),
    (select coalesce(sum(misc_fee_paise), 0) from public.services_orders where status = 'delivered' and created_at >= now() - interval '30 days'),
    (select coalesce(sum(gst_paise + delivery_gst_paise + misc_gst_paise), 0) from public.services_orders where status = 'delivered' and created_at >= now() - interval '30 days');
end;
$fn$;
revoke all on function public.services_admin_overview() from public, anon;
grant execute on function public.services_admin_overview() to authenticated;

create or replace function public.services_admin_orders(p_status text default null, p_limit int default 100)
returns table (id uuid, created_at timestamptz, status text, mode text,
               shop text, customer text, customer_phone text,
               total_paise int, charges_paise int)
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
           (o.gst_paise + o.delivery_fee_paise + o.delivery_gst_paise + o.misc_fee_paise + o.misc_gst_paise)::int
      from public.services_orders o
      join public.services_workers w on w.id = o.worker_id
      join public.services_signups c on c.id = o.customer_id
     where p_status is null or o.status = p_status
     order by o.created_at desc
     limit least(greatest(coalesce(p_limit, 100), 1), 300);
end;
$fn$;
revoke all on function public.services_admin_orders(text, int) from public, anon;
grant execute on function public.services_admin_orders(text, int) to authenticated;
notify pgrst, 'reload schema';
select '167 part 1 done' as "167_1";
