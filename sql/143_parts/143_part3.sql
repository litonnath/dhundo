-- 143 part 3: the order lists carry the delivery fee and where the rider is in
-- the job, so the customer can follow the order. Replaces 117 part 8.
drop function if exists public.services_my_orders();
create function public.services_my_orders()
returns table (id uuid, role text, status text, mode text, total_paise int,
               other_name text, other_phone text, address_text text, note text,
               lines jsonb, created_at timestamptz, delivery_mins int,
               rider_name text, rider_phone text, delivery_fee_paise int, job_status text)
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
         o.delivery_fee_paise, j.status::text
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
         o.delivery_fee_paise, j.status::text
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
select 'part 3 of 4 done' as "143_part3";
