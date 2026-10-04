-- ===========================================================================
-- 116_part7.sql -- each side reads its orders. The restaurant number is shown
-- to the customer once the order is accepted; the owner sees the customer
-- name and number, since the customer chose to order.
-- ===========================================================================
drop function if exists public.services_my_orders();
create function public.services_my_orders()
returns table (id uuid, role text, status text, mode text, total_paise int,
               other_name text, other_phone text, address_text text, note text,
               lines jsonb, created_at timestamptz)
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
         o.created_at
    from public.services_orders o
    join public.services_workers w on w.id = o.worker_id
   where o.customer_id = public.services_account_id()
   union all
  select o.id, 'owner'::text, o.status, o.mode, o.total_paise,
         c.full_name::text, c.phone::text, o.address_text, o.note,
         (select jsonb_agg(jsonb_build_object('name', l.name, 'qty', l.qty, 'price_paise', l.price_paise))
            from public.services_order_lines l where l.order_id = o.id),
         o.created_at
    from public.services_orders o
    join public.services_workers w on w.id = o.worker_id and w.user_id = public.services_account_id()
    join public.services_signups c on c.id = o.customer_id
   order by 11 desc
   limit 60;
$fn$;
revoke all on function public.services_my_orders() from public, anon, authenticated;
grant execute on function public.services_my_orders() to authenticated;

select 'part 7 of 8 done' as "116_part7";
