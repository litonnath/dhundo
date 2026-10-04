-- ===========================================================================
-- 110_part2.sql -- contact reveal: limit 15 an hour, and a checked phone
-- when the setting reveal_needs_phone is on. Same answer shape as before.
-- ===========================================================================
create or replace function public.services_reveal_contact(p_worker_id uuid)
returns table (ok boolean, reason text, phone text, full_name text,
               address_line text, landmark text, pincode text,
               vehicle_number text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_viewer uuid := public.services_account_id();
  w        record;
  v_recent int;
begin
  if v_viewer is null then
    return query select false, 'sign_in_required'::text, null::text, null::text, null::text, null::text, null::text, null::text;
    return;
  end if;
  if public.services_setting('reveal_needs_phone') = 'on'
     and not public.services_account_phone_ok(v_viewer) then
    return query select false, 'phone_not_verified'::text, null::text, null::text, null::text, null::text, null::text, null::text;
    return;
  end if;
  select count(*) into v_recent from public.services_contact_views v
   where v.viewer_id = v_viewer and v.created_at > now() - interval '1 hour';
  if v_recent >= 15 then
    return query select false, 'rate_limited'::text, null::text, null::text, null::text, null::text, null::text, null::text;
    return;
  end if;
  select * into w from public.services_workers x
   where x.id = p_worker_id and x.status = 'approved' and x.available;
  if not found then
    return query select false, 'not_found'::text, null::text, null::text, null::text, null::text, null::text, null::text;
    return;
  end if;
  insert into public.services_contact_views (worker_id, viewer_id) values (p_worker_id, v_viewer);
  return query select true, 'ok'::text, w.phone::text, w.full_name::text,
    w.address_line::text, w.landmark::text, w.pincode::text,
    (select case when t.requires_vehicle then w.vehicle_number end
       from public.services_trades t where t.slug = w.trade_slug)::text;
end;
$fn$;

revoke all on function public.services_reveal_contact(uuid) from public, anon, authenticated;
grant execute on function public.services_reveal_contact(uuid) to authenticated;

select 'part 2 of 4 done' as "110_part2";
