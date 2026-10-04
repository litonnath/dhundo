-- 93 part 3 of 5: guards on the tables. They apply to the owner of the row
-- only: admins, other people acting on a row (a report, a view) and internal
-- jobs with no signed-in person pass straight through.
-- Errors: consent_required (HTTP 403, hint = which) and rate_limited (HTTP 429, hint = what).

create or replace function public.services_guard_presence()
returns trigger language plpgsql security definer
set search_path to 'public' as $fn$
declare
  v_me uuid := public.services_account_id();
  v_owner uuid;
begin
  if v_me is null or public.services_is_admin() then return new; end if;
  select w.user_id into v_owner from public.services_workers w where w.id = new.worker_id;
  if v_owner is distinct from v_me then return new; end if;
  if not public.services_has_consent(v_me, 'live') then
    raise exception 'consent_required' using hint = 'live', errcode = 'PT403';
  end if;
  perform public.services_rate_guard('presence', v_me::text, 240, 3600);
  return new;
end;
$fn$;

drop trigger if exists services_presence_00_guard on public.services_presence;
create trigger services_presence_00_guard
  before insert or update on public.services_presence
  for each row execute function public.services_guard_presence();

create or replace function public.services_guard_workers()
returns trigger language plpgsql security definer
set search_path to 'public' as $fn$
declare
  v_me   uuid := public.services_account_id();
  v_skip text[] := array['lat','lng','loc_source','updated_at','status','verified',
                         'available','district','rejection_reason'];
  v_edit boolean;
begin
  if v_me is null or public.services_is_admin() or new.user_id is distinct from v_me then
    return new;
  end if;
  v_edit := tg_op = 'INSERT' or ((to_jsonb(new) - v_skip) is distinct from (to_jsonb(old) - v_skip));
  if v_edit then
    if not public.services_has_consent(v_me, 'listing') then
      raise exception 'consent_required' using hint = 'listing', errcode = 'PT403';
    end if;
    if tg_op = 'INSERT' then
      perform public.services_rate_guard('listing_new', v_me::text, 5, 86400);
    else
      perform public.services_rate_guard('listing_edit', v_me::text, 60, 86400);
    end if;
  end if;
  -- A position taken from the phone GPS and stored on the listing.
  if new.loc_source = 'device' and new.lat is not null
     and (tg_op = 'INSERT' or old.loc_source is distinct from 'device'
          or old.lat is distinct from new.lat or old.lng is distinct from new.lng) then
    if not public.services_has_consent(v_me, 'location') then
      raise exception 'consent_required' using hint = 'location', errcode = 'PT403';
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists services_workers_00_guard on public.services_workers;
create trigger services_workers_00_guard
  before insert or update on public.services_workers
  for each row execute function public.services_guard_workers();

notify pgrst, 'reload schema';
select 'part 3 done' as "93_part3";
