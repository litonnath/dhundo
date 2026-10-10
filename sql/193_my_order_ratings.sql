-- ===========================================================================
-- 193_my_order_ratings.sql -- the ratings I gave on my orders, so the order card
-- can show them: the restaurant / shop review (target 'shop') and the delivery
-- rider rating (target 'rider'). Run after 187.
-- ===========================================================================
create or replace function public.services_my_order_ratings(p_orders uuid[])
returns table (order_id uuid, target text, stars int, comment text, complaint boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select rv.ref_id, 'shop'::text, rv.stars, rv.comment::text, rv.complaint
    from public.services_reviews rv
   where rv.reviewer_id = public.services_account_id() and rv.kind = 'order'
     and rv.ref_id = any (coalesce(p_orders, '{}'::uuid[]))
  union all
  select r.order_id, 'rider'::text, r.stars, r.comment::text, r.complaint
    from public.services_delivery_ratings r
   where r.from_account = public.services_account_id() and r.by_role = 'customer'
     and r.order_id = any (coalesce(p_orders, '{}'::uuid[]));
$fn$;
revoke all on function public.services_my_order_ratings(uuid[]) from public, anon;
grant execute on function public.services_my_order_ratings(uuid[]) to authenticated;
notify pgrst, 'reload schema';
select '193 my order ratings done' as "193";
