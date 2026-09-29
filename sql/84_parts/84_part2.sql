-- 84 part 2 of 6: posting and editing an ad.

create or replace function public.services_item_save(
  p_id uuid, p_title text, p_description text, p_category text, p_price int,
  p_negotiable boolean, p_condition text, p_brand text, p_model_year int,
  p_km_driven int, p_photos text[], p_state text, p_city text, p_locality text,
  p_lat double precision, p_lng double precision, p_whatsapp boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_txt text := lower(coalesce(p_title, '') || ' ' || coalesce(p_description, ''));
  v_old text[];
  v_id uuid;
  p      text;
begin
  if v_me is null then return public.services_item_no('sign_in_required'); end if;
  if length(btrim(coalesce(p_title, ''))) not between 3 and 80 then
    return public.services_item_no('bad_title'); end if;
  if p_price is null or p_price not between 0 and 100000000 then
    return public.services_item_no('bad_price'); end if;
  if coalesce(cardinality(p_photos), 0) not between 1 and 6 then
    return public.services_item_no('bad_photos'); end if;
  if not public.services_is_state(p_state) then
    return public.services_item_no('bad_state'); end if;
  -- own photos only
  foreach p in array p_photos loop
    if p not like '%/object/public/services-photos/' || v_me::text || '/%' then
      return public.services_item_no('bad_photos'); end if;
  end loop;
  -- banned items
  if v_txt ~ '(\m(gun|pistol|revolver|rifle|bullet|ganja|charas|cannabis|drugs?|cocaine|heroin|liquor|alcohol|daru|sharab|whisky|beer|cigarettes?|ivory|tiger skin|puppy|puppies|kitten|parrot|human|kidney|aadhaar|pan card)\M)' then
    return public.services_item_no('not_allowed'); end if;

  if p_id is null then
    if (select count(*) from public.services_items
         where seller_id = v_me and status = 'active' and expires_at > now()) >= 5 then
      return public.services_item_no('limit'); end if;
    insert into public.services_items (seller_id, title, description, category, price,
      negotiable, condition, brand, model_year, km_driven, photos, state, city, locality,
      lat, lng, whatsapp)
    values (v_me, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), p_category,
      p_price, coalesce(p_negotiable, true), coalesce(p_condition, 'used'),
      nullif(btrim(coalesce(p_brand, '')), ''), p_model_year, p_km_driven, p_photos, p_state,
      nullif(btrim(coalesce(p_city, '')), ''), nullif(btrim(coalesce(p_locality, '')), ''),
      p_lat, p_lng, coalesce(p_whatsapp, true))
    returning id into v_id;
  else
    select photos into v_old from public.services_items
     where id = p_id and seller_id = v_me and status <> 'removed';
    if not found then return public.services_item_no('not_found'); end if;
    update public.services_items set title = btrim(p_title),
      description = nullif(btrim(coalesce(p_description, '')), ''), category = p_category,
      price = p_price, negotiable = coalesce(p_negotiable, true),
      condition = coalesce(p_condition, 'used'), brand = nullif(btrim(coalesce(p_brand, '')), ''),
      model_year = p_model_year, km_driven = p_km_driven, photos = p_photos, state = p_state,
      city = nullif(btrim(coalesce(p_city, '')), ''),
      locality = nullif(btrim(coalesce(p_locality, '')), ''), lat = p_lat, lng = p_lng,
      whatsapp = coalesce(p_whatsapp, true), updated_at = now()
     where id = p_id;
    foreach p in array v_old loop
      if not (p = any(p_photos)) then
        perform public.services_queue_delete('services-photos',
          regexp_replace(p, '^.*/object/public/services-photos/', ''));
      end if;
    end loop;
    v_id := p_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$fn$;

revoke all on function public.services_item_save(uuid, text, text, text, int, boolean, text, text,
  int, int, text[], text, text, text, double precision, double precision, boolean) from public, anon;
grant execute on function public.services_item_save(uuid, text, text, text, int, boolean, text, text,
  int, int, text[], text, text, text, double precision, double precision, boolean) to authenticated;

select 'part 2 done' as "84_part2";
