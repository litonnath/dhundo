-- 164 part 2: order lists also carry the GST on the items (gst_paise and the other customer charges), saved on the order by 164. Replaces 146 part 1. Run after 164_order_charges.sql.
drop function if exists public.services_my_orders();
create function public.services_my_orders()
returns table (id uuid, role text, status text, mode text, total_paise int,
               other_name text, other_phone text, address_text text, note text,
               lines jsonb, created_at timestamptz, delivery_mins int,
               rider_name text, rider_phone text, delivery_fee_paise int, job_status text, dist_km numeric, job_id uuid, gst_paise int, delivery_gst_paise int, misc_fee_paise int, misc_gst_paise int, cust_lat double precision, cust_lng double precision)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select o.id, 'customer'::text, o.status, o.mode, o.total_paise,
         coalesce(nullif(btrim(w.business_name), ''), w.full_name)::text,
         case when o.status in ('accepted', 'ready', 'delivered') then w.phone::text end,
         o.address_text, o.note,
         (select jsonb_agg(jsonb_build_object('name', l.name, 'qty', l.qty, 'price_paise', l.price_paise))
            from public.services_order_lines l where l.order_id = o.id),
         o.created_at, w.delivery_mins,
         case when j.status in ('accepted', 'picked_up') then r.full_name::text end,
         case when j.status in ('accepted', 'picked_up') then r.phone::text end,
         o.delivery_fee_paise, (case when j.status = 'open' and j.expires_at <= now() then 'expired' else j.status end)::text,
         case when w.lat is null or o.lat is null then null
              else round(public.services_km(w.lat, w.lng, o.lat, o.lng)::numeric * 1.3, 1) end,
         o.job_id,
         o.gst_paise, o.delivery_gst_paise, o.misc_fee_paise, o.misc_gst_paise, o.lat, o.lng
    from public.services_orders o
    join public.services_workers w on w.id = o.worker_id
    left join public.services_jobs j on j.id = o.job_id
    left join public.services_workers r on r.id = j.rider_work
   where o.customer_id = public.services_account_id()
   union all
  select o.id, 'owner'::text, o.status, o.mode, o.total_paise,
         c.full_name::text, c.phone::text, o.address_text, o.note,
         (select jsonb_agg(jsonb_build_object('name', l.name, 'qty', l.qty, 'price_paise', l.price_paise))
            from public.services_order_lines l where l.order_id = o.id),
         o.created_at, w.delivery_mins,
         case when j.status in ('accepted', 'picked_up') then r.full_name::text end,
         case when j.status in ('accepted', 'picked_up') then r.phone::text end,
         o.delivery_fee_paise, (case when j.status = 'open' and j.expires_at <= now() then 'expired' else j.status end)::text,
         case when w.lat is null or o.lat is null then null
              else round(public.services_km(w.lat, w.lng, o.lat, o.lng)::numeric * 1.3, 1) end,
         o.job_id,
         o.gst_paise, o.delivery_gst_paise, o.misc_fee_paise, o.misc_gst_paise, o.lat, o.lng
    from public.services_orders o
    join public.services_workers w on w.id = o.worker_id and w.user_id = public.services_account_id()
    join public.services_signups c on c.id = o.customer_id
    left join public.services_jobs j on j.id = o.job_id
    left join public.services_workers r on r.id = j.rider_work
   order by 11 desc
   limit 60;
$fn$;
revoke all on function public.services_my_orders() from public, anon, authenticated;
grant execute on function public.services_my_orders() to authenticated;
notify pgrst, 'reload schema';
select '164 orders gst done' as "164_orders_gst";
