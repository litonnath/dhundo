-- ===========================================================================
-- 120_part3.sql -- anyone can read the public store info: hours, delivery
-- time, the offer, and a rider fare per kilometre.
-- ===========================================================================
drop function if exists public.services_store_infos(uuid[]);
create function public.services_store_infos(p_ids uuid[])
returns table (id uuid, open_now boolean, open_time time, close_time time, delivery_mins int,
               promo_text text, promo_photo text, per_km_rupees int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.id, public.services_is_open_now(w.open_time, w.close_time, w.accepting_orders),
         w.open_time, w.close_time, w.delivery_mins, w.promo_text, w.promo_photo, w.per_km_rupees
    from public.services_workers w
   where w.id = any (p_ids) and w.status = 'approved';
$fn$;
revoke all on function public.services_store_infos(uuid[]) from public;
grant execute on function public.services_store_infos(uuid[]) to anon, authenticated;

select 'part 3 of 8 done' as "120_part3";
