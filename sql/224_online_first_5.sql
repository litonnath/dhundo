-- 224_online_first_5.sql -- part 5 of 5: order lists carry pay_hold and the cash fee; a held order is hidden from the shop. Replaces 164_orders_gst.
drop function if exists public.services_my_orders();
create function public.services_my_orders()
returns table (id uuid, role text, status text, mode text, total_paise int,
               other_name text, other_phone text, address_text text, note text,
               lines jsonb, created_at timestamptz, delivery_mins int,
               rider_name text, rider_phone text, delivery_fee_paise int, job_status text, dist_km numeric, job_id uuid, gst_paise int, delivery_gst_paise int, misc_fee_paise int, misc_gst_paise int, cust_lat double precision, cust_lng double precision,
               updated_at timestamptz, cancelled_by text, cancel_reason text, rider_after timestamptz, worker_id uuid,
               pay_method text, paid boolean, upi_claimed boolean, rider_fee_paise int, rider_avg numeric, rider_n int, pay_hold boolean, cod_fee_paise int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select o.id, 'customer'::text, o.status, o.mode, o.total_paise,
         coalesce(nullif(btrim(w.business_name), ''), w.full_name)::text,
         w.phone::text,
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
         o.gst_paise, o.delivery_gst_paise, o.misc_fee_paise, o.misc_gst_paise, o.lat, o.lng,
         o.updated_at, o.cancelled_by, o.cancel_reason, o.rider_after, o.worker_id,
         o.pay_method, o.paid, o.upi_claimed, j.fee_paise,
         (select round(avg(x.stars)::numeric, 1) from public.services_delivery_ratings x where x.to_account = r.user_id and x.by_role = 'customer'),
         (select count(*)::int from public.services_delivery_ratings x where x.to_account = r.user_id and x.by_role = 'customer'),
         o.pay_hold, o.cod_fee_paise
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
         0, 0, 0, 0, o.lat, o.lng,
         o.updated_at, o.cancelled_by, o.cancel_reason, o.rider_after, o.worker_id,
         o.pay_method, o.paid, o.upi_claimed, null::int,
         null::numeric,
         null::int,
         false, 0
    from public.services_orders o
    join public.services_workers w on w.id = o.worker_id and w.user_id = public.services_account_id()
    join public.services_signups c on c.id = o.customer_id and not o.pay_hold
    left join public.services_jobs j on j.id = o.job_id
    left join public.services_workers r on r.id = j.rider_work
   order by 11 desc
   limit 60;
$fn$;
revoke all on function public.services_my_orders() from public, anon, authenticated;
grant execute on function public.services_my_orders() to authenticated;
notify pgrst, 'reload schema';
select '224 online first part 5 done' as "224_5";
