-- ===========================================================================
-- 86 part 1 of 1: worker position, map places before post offices.
-- Replaces the rule from 85. Then run 85_parts/85_part2.sql again to place
-- every listing with it.
-- ===========================================================================

create or replace function public.services_fill_area_coords()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_city_place text; v_city_lat double precision; v_city_lng double precision;
  v_pin_dist text; v_pin_lat double precision; v_pin_lng double precision;
  v_ref_lat double precision; v_ref_lng double precision;
  v_area_lat double precision; v_area_lng double precision;
  v_state text;
begin
  if new.city_id is not null then
    select r.place, r.district, r.state, r.lat, r.lng
      into v_city_place, new.district, v_state, v_city_lat, v_city_lng
      from public.services_regions r where r.id = new.city_id;
    if v_city_place is not null then
      new.city := v_city_place;
      if v_state is not null then new.state := v_state; end if;
    end if;
  end if;

  if new.loc_source = 'device' and new.lat is not null then
    return new;
  end if;

  if new.pincode is not null and btrim(new.pincode) <> '' then
    select pc.district, pc.lat, pc.lng into v_pin_dist, v_pin_lat, v_pin_lng
      from public.services_pincodes pc
     where pc.pincode = regexp_replace(new.pincode, '\D', '', 'g');
    if new.district is null then new.district := v_pin_dist; end if;
  end if;

  -- The village or area. Map places (OpenStreetMap, GeoNames) come before
  -- post offices, whose positions are often only roughly right; a post
  -- office is trusted only within 15 km of the town or PIN, a map place
  -- within 40. "Tilthai Nutanbazar" may be on the map as just "Tilthai",
  -- so the first word is tried too, on map places only.
  v_ref_lat := coalesce(v_city_lat, v_pin_lat);
  v_ref_lng := coalesce(v_city_lng, v_pin_lng);
  if new.locality is not null and btrim(new.locality) <> '' then
    select c.lat, c.lng into v_area_lat, v_area_lng from (
      select r.lat, r.lng, r.district,
             coalesce(to_jsonb(r) ->> 'source', '') = 'post' as is_post,
             lower(r.place) = lower(btrim(new.locality)) as exact,
             case when v_ref_lat is null then null
                  else public.services_km(v_ref_lat, v_ref_lng, r.lat, r.lng) end as km
        from public.services_regions r
       where r.state = new.state and r.lat is not null
         and (lower(r.place) = lower(btrim(new.locality))
              or (length(split_part(btrim(new.locality), ' ', 1)) >= 4
                  and lower(r.place) = lower(split_part(btrim(new.locality), ' ', 1))))
    ) c
     where (c.km is null or c.km <= case when c.is_post then 15 else 40 end)
       and (c.exact or not c.is_post)
     order by c.is_post, c.exact desc, (c.district = new.district) desc nulls last, c.km nulls last
     limit 1;
    if v_area_lat is not null then
      new.lat := v_area_lat; new.lng := v_area_lng; new.loc_source := 'area';
      return new;
    end if;
  end if;

  -- A PIN centre comes from the same postal data; used only near the town.
  if v_pin_lat is not null and (v_city_lat is null
      or public.services_km(v_city_lat, v_city_lng, v_pin_lat, v_pin_lng) <= 12) then
    new.lat := v_pin_lat; new.lng := v_pin_lng; new.loc_source := 'pin';
    return new;
  end if;

  if v_city_lat is not null then
    new.lat := v_city_lat; new.lng := v_city_lng; new.loc_source := 'city';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
select 'done: now run 85_parts/85_part2.sql again' as "86";
