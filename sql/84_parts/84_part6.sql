-- 84 part 6 of 6: reporting a bad ad, and the admin tools for ads.
-- Three reports from different people hide an ad until an admin looks.

create or replace function public.services_item_report(p_id uuid, p_reason text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_n int;
begin
  if v_me is null then return public.services_item_no('sign_in_required'); end if;
  if p_reason not in ('fraud', 'sold', 'wrong', 'not_allowed', 'offensive', 'duplicate', 'other') then
    return public.services_item_no('bad_reason'); end if;
  if not exists (select 1 from public.services_items where id = p_id and seller_id <> v_me) then
    return public.services_item_no('not_found'); end if;
  insert into public.services_item_reports (item_id, reporter_id, reason, note)
  values (p_id, v_me, p_reason, left(nullif(btrim(coalesce(p_note, '')), ''), 300))
  on conflict do nothing;
  select count(*) into v_n from public.services_item_reports where item_id = p_id;
  update public.services_items set report_count = v_n, hidden = hidden or v_n >= 3 where id = p_id;
  return jsonb_build_object('ok', true);
end;
$fn$;

create or replace function public.services_admin_items(p_filter text default 'reported', p_limit int default 100)
returns setof jsonb
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select to_jsonb(i) || jsonb_build_object('seller_name', s.full_name, 'seller_phone', s.phone,
           'reasons', (select jsonb_agg(jsonb_build_object('reason', r.reason, 'note', r.note))
                         from public.services_item_reports r where r.item_id = i.id))
    from public.services_items i join public.services_signups s on s.id = i.seller_id
   where public.services_is_admin()
     and case coalesce(p_filter, 'reported')
           when 'reported' then i.report_count > 0 and i.status <> 'removed'
           when 'removed'  then i.status = 'removed'
           else true end
   order by i.report_count desc, i.created_at desc
   limit greatest(1, least(coalesce(p_limit, 100), 300));
$fn$;

-- remove (hide for good), restore (clear reports), delete (gone, photos too)
create or replace function public.services_admin_item_action(p_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then return public.services_item_no('not_admin'); end if;
  if p_action = 'remove' then
    update public.services_items set status = 'removed', hidden = true where id = p_id;
  elsif p_action = 'restore' then
    delete from public.services_item_reports where item_id = p_id;
    update public.services_items set status = 'active', hidden = false, report_count = 0 where id = p_id;
  elsif p_action = 'delete' then
    delete from public.services_items where id = p_id;
  else
    return public.services_item_no('bad_action');
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.services_item_report(uuid, text, text) from public, anon;
grant execute on function public.services_item_report(uuid, text, text) to authenticated;
revoke all on function public.services_admin_items(text, int) from public, anon;
grant execute on function public.services_admin_items(text, int) to authenticated;
revoke all on function public.services_admin_item_action(uuid, text) from public, anon;
grant execute on function public.services_admin_item_action(uuid, text) to authenticated;


notify pgrst, 'reload schema';
select jsonb_pretty(jsonb_build_object(
  'tables', (select count(*) from pg_class where relname in
              ('services_items', 'services_item_reports', 'services_item_reveals')),
  'functions', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
                  and (proname like 'services\_item%' or proname like 'services\_admin\_item%'
                       or proname = 'services_my_items')),
  'expected', 'tables 3; functions 12'
)) as "84_verify";
