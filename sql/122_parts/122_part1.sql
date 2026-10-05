-- ===========================================================================
-- 122_part1.sql -- shops and food places near a person, within a radius
-- (30 km by default, 100 at most), with the dishes or goods that match what
-- they typed. Listings with no pinned spot, or further away, are not returned.
-- ===========================================================================
drop function if exists public.services_stores_near(text, double precision, double precision, text, text, double precision, int);
create function public.services_stores_near(
  p_kind      text,
  p_lat       double precision,
  p_lng       double precision,
  p_trade     text             default null,
  p_q         text             default null,
  p_radius_km double precision default 30,
  p_limit     int              default 40
)
returns table (id uuid, display_name text, trade_slug text, trade_name text, locality text,
               photos jsonb, avatar_url text, distance_km numeric, items jsonb)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_rad double precision := greatest(1, least(coalesce(p_radius_km, 30), 100));
  v_deg double precision := greatest(1, least(coalesce(p_radius_km, 30), 100)) / 111.0;
  v_q   text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if p_lat is null or p_lng is null then
    return;
  end if;
  return query
  select * from (
    select w.id,
           coalesce(nullif(btrim(w.business_name), ''), w.full_name)::text as display_name,
           w.trade_slug::text, t.name_en::text, w.locality::text,
           to_jsonb(w.photos), w.avatar_url::text,
           round(public.services_km(p_lat, p_lng, w.lat, w.lng)::numeric, 1) as distance_km,
           (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'price_paise', x.price_paise, 'photo', x.photo_url)), '[]'::jsonb)
              from (select m.name, m.price_paise, m.photo_url
                      from public.services_menu_items m
                     where m.worker_id = w.id and m.available
                       and v_q is not null and m.name ilike '%' || v_q || '%'
                     order by m.name limit 4) x) as items
      from public.services_workers w
      join public.services_trades t on t.slug = w.trade_slug
     where w.status = 'approved'
       and w.lat is not null and w.lng is not null
       and w.lat between p_lat - v_deg and p_lat + v_deg
       and w.lng between p_lng - v_deg / greatest(cos(radians(p_lat)), 0.2)
                     and p_lng + v_deg / greatest(cos(radians(p_lat)), 0.2)
       and (case when p_kind = 'eat' then t.group_name = 'Eat & Stay'
                 else t.kind = 'supplier' and t.group_name <> 'Eat & Stay' end)
       and w.trade_slug not in ('hotel-lodge', 'homestay-guesthouse')
       and (p_trade is null or w.trade_slug = p_trade)
       and (v_q is null
            or coalesce(w.business_name, '') ilike '%' || v_q || '%'
            or w.full_name ilike '%' || v_q || '%'
            or t.name_en ilike '%' || v_q || '%'
            or exists (select 1 from public.services_menu_items m
                        where m.worker_id = w.id and m.available and m.name ilike '%' || v_q || '%'))
  ) s
  where s.distance_km <= v_rad
  order by s.distance_km
  limit greatest(1, least(coalesce(p_limit, 40), 100));
end;
$fn$;
revoke all on function public.services_stores_near(text, double precision, double precision, text, text, double precision, int) from public;
grant execute on function public.services_stores_near(text, double precision, double precision, text, text, double precision, int) to anon, authenticated;
notify pgrst, 'reload schema';
select 'part 1 of 1 done' as "122_part1";
