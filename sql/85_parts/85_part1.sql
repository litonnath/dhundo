-- ===========================================================================
-- 85 part 1 of 2: worker position, village first
--
-- Distances were too long: a worker a few km away showed as 23 km. Their
-- position came from the PIN code centre before their own village, and a
-- PIN covers many villages, so the point could be far from where they live.
--
-- New order for where a worker is:
--   1. device -- their own GPS. Never overwritten.
--   2. area   -- their village or area, when it is a known place. Many
--                villages share a name, so the one nearest their town or PIN
--                is taken, and only within 40 km of it.
--   3. pin    -- the PIN code centre.
--   4. city   -- the town centre.
-- Part 2 then places every listing again with the new order.
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

  -- The village or area, nearest to the town or PIN when there is one.
  v_ref_lat := coalesce(v_city_lat, v_pin_lat);
  v_ref_lng := coalesce(v_city_lng, v_pin_lng);
  if new.locality is not null and btrim(new.locality) <> '' then
    select r.lat, r.lng into v_area_lat, v_area_lng
      from public.services_regions r
     where r.state = new.state
       and lower(r.place) = lower(btrim(new.locality))
       and r.lat is not null
       and (v_ref_lat is null
            or public.services_km(v_ref_lat, v_ref_lng, r.lat, r.lng) <= 40)
     order by case when r.district = new.district then 0 else 1 end,
              case when v_ref_lat is null then 0
                   else public.services_km(v_ref_lat, v_ref_lng, r.lat, r.lng) end
     limit 1;
    if v_area_lat is not null then
      new.lat := v_area_lat; new.lng := v_area_lng; new.loc_source := 'area';
      return new;
    end if;
  end if;

  if v_pin_lat is not null then
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
select 'part 1 done: new order in place' as "85_part1";
