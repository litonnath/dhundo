-- 84 part 3 of 6: marking sold, relisting, deleting, and my own ads.

-- sold, active (relist for 30 more days), delete
create or replace function public.services_item_set_status(p_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare v_me uuid := public.services_account_id();
begin
  if not exists (select 1 from public.services_items
                  where id = p_id and seller_id = v_me and status <> 'removed') then
    return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if p_action = 'sold' then
    update public.services_items set status = 'sold', updated_at = now() where id = p_id;
  elsif p_action = 'active' then
    if (select count(*) from public.services_items where seller_id = v_me and id <> p_id
          and status = 'active' and expires_at > now()) >= 5 then
      return jsonb_build_object('ok', false, 'reason', 'limit'); end if;
    update public.services_items set status = 'active', updated_at = now(),
      expires_at = now() + interval '30 days' where id = p_id;
  elsif p_action = 'delete' then
    delete from public.services_items where id = p_id;
  else
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;

create or replace function public.services_my_items()
returns setof jsonb
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select to_jsonb(i) - 'seller_id' - 'report_count'
         || jsonb_build_object('expired', i.expires_at <= now())
    from public.services_items i
   where i.seller_id = public.services_account_id() and i.status <> 'removed'
   order by i.created_at desc;
$fn$;

revoke all on function public.services_item_set_status(uuid, text) from public, anon;
grant execute on function public.services_item_set_status(uuid, text) to authenticated;
revoke all on function public.services_my_items() from public, anon;
grant execute on function public.services_my_items() to authenticated;

select 'part 3 done' as "84_part3";
