-- ===========================================================================
-- 98_directions.sql   (needs 93 and 94 already run)
--
-- Directions to a shop. services_worker_directions(id) gives the position of
-- ONE listing to a signed-in person, and only when
--   * the owner turned on "Show my full address on my listing" (the switch
--     for a shop people come to), and
--   * the position is an exact one (the phone GPS, or a pin placed on the
--     map), not the middle of a village.
-- Nothing else ever hands out a listing position: search results carry only
-- a distance, and a worker who is live is never given away by this.
-- Each person may ask 60 times an hour.
-- ===========================================================================
create or replace function public.services_worker_directions(p_worker_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  w    record;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in_required');
  end if;
  perform public.services_rate_guard('directions', v_me::text, 60, 3600);

  select x.lat, x.lng, x.address_public, x.loc_source into w
    from public.services_workers x
   where x.id = p_worker_id and x.status = 'approved' and x.available;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not coalesce(w.address_public, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_shared');
  end if;
  if w.lat is null or w.lng is null or coalesce(w.loc_source, '') not in ('device', 'picked') then
    return jsonb_build_object('ok', false, 'reason', 'not_exact');
  end if;
  return jsonb_build_object('ok', true, 'lat', w.lat, 'lng', w.lng);
end;
$fn$;

revoke all on function public.services_worker_directions(uuid) from public, anon, authenticated;
grant execute on function public.services_worker_directions(uuid) to authenticated;

notify pgrst, 'reload schema';
select 'done' as "98_directions";
