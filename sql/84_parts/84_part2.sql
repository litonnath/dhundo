-- 84 part 2 of 6: the checks an ad must pass before it is saved.
-- Returns null when the ad is fine, otherwise the reason it is refused.

create or replace function public.services_item_check(
  p_me uuid, p_title text, p_description text, p_price int, p_photos text[], p_state text
)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_txt text := lower(coalesce(p_title, '') || ' ' || coalesce(p_description, ''));
  p text;
begin
  if p_me is null then return 'sign_in_required'; end if;
  if length(btrim(coalesce(p_title, ''))) not between 3 and 80 then return 'bad_title'; end if;
  if p_price is null or p_price not between 0 and 100000000 then return 'bad_price'; end if;
  if coalesce(cardinality(p_photos), 0) not between 1 and 6 then return 'bad_photos'; end if;
  if not public.services_is_state(p_state) then return 'bad_state'; end if;
  -- only photos this account uploaded itself
  foreach p in array p_photos loop
    if p not like '%/object/public/services-photos/' || p_me::text || '/%' then
      return 'bad_photos'; end if;
  end loop;
  -- things that may not be sold here
  if v_txt ~ '(\m(gun|pistol|revolver|rifle|bullet|ganja|charas|cannabis|drugs?|cocaine|heroin|liquor|alcohol|daru|sharab|whisky|beer|cigarettes?|ivory|tiger skin|puppy|puppies|kitten|parrot|human|kidney|aadhaar|pan card)\M)' then
    return 'not_allowed'; end if;
  return null;
end;
$fn$;

revoke all on function public.services_item_check(uuid, text, text, int, text[], text) from public, anon, authenticated;

notify pgrst, 'reload schema';
select 'part 2 done' as "84_part2";
