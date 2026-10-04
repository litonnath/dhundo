-- 93 part 4 of 5: Buy and Sell, sign-up and profile guards.

create or replace function public.services_guard_items()
returns trigger language plpgsql security definer
set search_path to 'public' as $fn$
declare
  v_me   uuid := public.services_account_id();
  v_skip text[] := array['status','hidden','report_count','views','updated_at','expires_at'];
begin
  if v_me is null or public.services_is_admin() or new.seller_id is distinct from v_me then
    return new;
  end if;
  if tg_op = 'INSERT' or ((to_jsonb(new) - v_skip) is distinct from (to_jsonb(old) - v_skip)) then
    if not public.services_has_consent(v_me, 'market') then
      raise exception 'consent_required' using hint = 'market', errcode = 'PT403';
    end if;
    perform public.services_rate_guard(case when tg_op = 'INSERT' then 'item_new' else 'item_edit' end,
                                       v_me::text, case when tg_op = 'INSERT' then 10 else 60 end, 86400);
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_items_00_guard on public.services_items;
create trigger services_items_00_guard before insert or update on public.services_items
  for each row execute function public.services_guard_items();

create or replace function public.services_guard_reports()
returns trigger language plpgsql security definer
set search_path to 'public' as $fn$
begin
  if public.services_account_id() is not null and new.reporter_id = public.services_account_id() then
    perform public.services_rate_guard('item_report', new.reporter_id::text, 20, 86400);
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_item_reports_00_guard on public.services_item_reports;
create trigger services_item_reports_00_guard before insert on public.services_item_reports
  for each row execute function public.services_guard_reports();

-- New accounts: limited per IP, and only when the IP is known. Profile
-- address, email and PIN: need the profile consent, and few saves an hour.
create or replace function public.services_guard_signups()
returns trigger language plpgsql security definer
set search_path to 'public' as $fn$
declare
  v_me uuid := public.services_account_id();
  v_ip text := public.services_client_ip();
begin
  if tg_op = 'INSERT' then
    if v_ip <> 'unknown' then
      perform public.services_rate_guard('signup', v_ip, 30, 3600);
    end if;
    return new;
  end if;
  if v_me is null or public.services_is_admin() or new.id is distinct from v_me then
    return new;
  end if;
  if (new.email, new.address, new.city, new.state, new.pincode)
       is distinct from (old.email, old.address, old.city, old.state, old.pincode) then
    if coalesce(new.email, new.address, new.pincode, '') <> ''
       and not public.services_has_consent(v_me, 'profile') then
      raise exception 'consent_required' using hint = 'profile', errcode = 'PT403';
    end if;
    perform public.services_rate_guard('profile', v_me::text, 30, 3600);
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_signups_00_guard on public.services_signups;
create trigger services_signups_00_guard before insert or update on public.services_signups
  for each row execute function public.services_guard_signups();

notify pgrst, 'reload schema';
select 'part 4 done' as "93_part4";
