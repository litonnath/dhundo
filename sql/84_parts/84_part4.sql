-- 84 part 4 of 6: browsing ads, nearest first.

create or replace function public.services_items_browse(
  p_lat double precision default null, p_lng double precision default null,
  p_state text default null, p_category text default null, p_q text default null,
  p_min int default null, p_max int default null, p_radius_km double precision default null,
  p_sort text default 'near', p_limit int default 30, p_offset int default 0)
returns setof jsonb
language sql
stable
security definer
set search_path to 'public'
as $fn$
  with base as (
    select i.*, case when p_lat is null or p_lng is null or i.lat is null then null
                     else public.services_km(p_lat, p_lng, i.lat, i.lng) end as km
      from public.services_items i
     where i.status = 'active' and not i.hidden and i.expires_at > now()
       and (p_category is null or i.category = p_category)
       and (p_min is null or i.price >= p_min) and (p_max is null or i.price <= p_max)
       and (coalesce(btrim(p_q), '') = '' or (i.title || ' ' || coalesce(i.brand, '') || ' '
            || coalesce(i.description, '') || ' ' || coalesce(i.locality, '') || ' '
            || coalesce(i.city, '')) ilike '%' || btrim(p_q) || '%')
  ), f as (
    select * from base
     where (km is null and (p_state is null or state = p_state))
        or (km is not null and (p_radius_km is null or km <= p_radius_km))
  )
  select jsonb_build_object('id', id, 'title', title, 'price', price, 'negotiable', negotiable,
    'condition', condition, 'category', category, 'brand', brand, 'model_year', model_year,
    'km_driven', km_driven, 'photo', photos[1], 'photo_count', cardinality(photos),
    'city', city, 'locality', locality, 'state', state, 'created_at', created_at,
    'distance_km', round(km::numeric, 1), 'total_count', count(*) over ())
    from f
   order by case when coalesce(p_sort, 'near') = 'near' then km end nulls last,
            case when p_sort = 'price_low' then price end asc,
            case when p_sort = 'price_high' then price end desc,
            created_at desc
   limit greatest(1, least(coalesce(p_limit, 30), 60)) offset greatest(0, coalesce(p_offset, 0));
$fn$;

grant execute on function public.services_items_browse(double precision, double precision, text,
  text, text, int, int, double precision, text, int, int) to anon, authenticated;


notify pgrst, 'reload schema';
select 'part 4 done' as "84_part4";
