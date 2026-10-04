-- 93 part 2 of 5: the consent functions the app calls.

create or replace function public.services_has_consent(p_account uuid, p_purpose text)
returns boolean language sql stable security definer
set search_path to 'public' as $fn$
  select coalesce((select c.granted from public.services_consents c
                    where c.account_id = p_account and c.purpose = p_purpose), false);
$fn$;
revoke all on function public.services_has_consent(uuid, text) from public, anon, authenticated;

-- Record an answer. Withdrawing live or location also stops what was running:
-- the live position is deleted, and a listing placed by GPS goes back to the
-- position of its area.
create or replace function public.services_record_consent(
  p_purpose text, p_granted boolean, p_version int default 1)
returns jsonb language plpgsql volatile security definer
set search_path to 'public' as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in_required');
  end if;
  if p_purpose is null or p_purpose not in ('location','live','account','listing','market','profile') then
    return jsonb_build_object('ok', false, 'reason', 'bad_purpose');
  end if;
  perform public.services_rate_guard('consent', v_me::text, 60, 3600);

  insert into public.services_consents (account_id, purpose, version, granted, at)
  values (v_me, p_purpose, greatest(coalesce(p_version, 1), 1), coalesce(p_granted, false), now())
  on conflict (account_id, purpose) do update
     set version = excluded.version, granted = excluded.granted, at = now();
  insert into public.services_consent_log (account_id, purpose, version, granted)
  values (v_me, p_purpose, greatest(coalesce(p_version, 1), 1), coalesce(p_granted, false));

  if not coalesce(p_granted, false) and p_purpose in ('live', 'location') then
    delete from public.services_presence
     where worker_id in (select w.id from public.services_workers w where w.user_id = v_me);
  end if;
  if not coalesce(p_granted, false) and p_purpose = 'location' then
    update public.services_workers
       set loc_source = 'area', locality = locality
     where user_id = v_me and loc_source = 'device';
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;

create or replace function public.services_my_consents()
returns jsonb language sql stable security definer
set search_path to 'public' as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'purpose', c.purpose, 'granted', c.granted, 'version', c.version, 'at', c.at)), '[]'::jsonb)
    from public.services_consents c
   where c.account_id = public.services_account_id();
$fn$;

revoke all on function public.services_record_consent(text, boolean, int) from public, anon, authenticated;
revoke all on function public.services_my_consents() from public, anon, authenticated;
grant execute on function public.services_record_consent(text, boolean, int) to authenticated;
grant execute on function public.services_my_consents() to authenticated;

notify pgrst, 'reload schema';
select 'part 2 done' as "93_part2";
