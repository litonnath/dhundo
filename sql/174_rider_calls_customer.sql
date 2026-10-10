-- ===========================================================================
-- 174_rider_calls_customer.sql -- the delivery rider can call the customer, and
-- navigate to the drop, once the job is accepted. The customer's name, phone
-- and map point come from the order linked to the job, and are shown only to
-- the rider who holds the job (not while it is open). Also due_at: when the
-- customer was promised the food (order time + the shop's delivery estimate). Replaces 113 part 5.
-- ===========================================================================
drop function if exists public.services_my_jobs();
create function public.services_my_jobs()
returns table (id uuid, role text, status text, note text, drop_text text, fee_paise int,
               other_name text, other_phone text, created_at timestamptz, expires_at timestamptz,
               pickup_lat double precision, pickup_lng double precision,
               customer_name text, customer_phone text,
               drop_lat double precision, drop_lng double precision,
               due_at timestamptz, pay_method text, paid boolean, due_paise int, order_id uuid,
               cust_avg numeric, cust_n int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select j.id, 'shop'::text, case when j.status = 'open' and j.expires_at <= now() then 'expired' else j.status end,
         j.note, j.drop_text, j.fee_paise,
         case when j.rider_work is not null then r.full_name::text end,
         case when j.rider_work is not null then r.phone::text end,
         j.created_at, j.expires_at, null::double precision, null::double precision,
         null::text, null::text, null::double precision, null::double precision, null::timestamptz,
         null::text, null::boolean, null::int, null::uuid,
         null::numeric, null::int
    from public.services_jobs j
    left join public.services_workers r on r.id = j.rider_work
   where j.poster_id = public.services_account_id() and j.created_at > now() - interval '3 days'
  union all
  select j.id, 'rider'::text, j.status, j.note, j.drop_text, j.fee_paise,
         coalesce(nullif(btrim(p.business_name), ''), p.full_name)::text, p.phone::text,
         j.created_at, j.expires_at,
         case when j.status in ('accepted', 'picked_up') then coalesce(p.lat, j.pickup_lat) end,
         case when j.status in ('accepted', 'picked_up') then coalesce(p.lng, j.pickup_lng) end,
         case when j.status in ('accepted', 'picked_up') then c.full_name::text end,
         case when j.status in ('accepted', 'picked_up') then c.phone::text end,
         case when j.status in ('accepted', 'picked_up') then coalesce(o.lat, j.drop_lat) end,
         case when j.status in ('accepted', 'picked_up') then coalesce(o.lng, j.drop_lng) end,
         case when o.id is not null then o.created_at + make_interval(mins => coalesce(p.delivery_mins, 60)) end,
         o.pay_method, o.paid,
         case when o.id is not null then o.total_paise + o.gst_paise + o.delivery_fee_paise + o.delivery_gst_paise + o.misc_fee_paise + o.misc_gst_paise end,
         o.id,
         (select round(avg(x.stars)::numeric, 1) from public.services_delivery_ratings x where x.to_account = o.customer_id and x.by_role = 'rider'),
         (select count(*)::int from public.services_delivery_ratings x where x.to_account = o.customer_id and x.by_role = 'rider')
    from public.services_jobs j
    join public.services_workers rw on rw.id = j.rider_work and rw.user_id = public.services_account_id()
    join public.services_workers p on p.id = j.poster_work
    left join public.services_orders o on o.job_id = j.id
    left join public.services_signups c on c.id = o.customer_id
   where j.created_at > now() - interval '3 days'
  order by 9 desc;
$fn$;
revoke all on function public.services_my_jobs() from public, anon, authenticated;
grant execute on function public.services_my_jobs() to authenticated;
notify pgrst, 'reload schema';
select '174 rider calls customer done' as "174";
