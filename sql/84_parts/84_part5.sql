-- 84 part 5 of 6: opening an ad, and showing the seller phone number.

create or replace function public.services_item_get(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v jsonb;
begin
  select to_jsonb(i) - 'seller_id' - 'report_count' - 'hidden' || jsonb_build_object(
      'seller_name', split_part(btrim(coalesce(s.full_name, '')), ' ', 1),
      'seller_since', to_jsonb(s) -> 'created_at',
      'seller_ads', (select count(*) from public.services_items x where x.seller_id = i.seller_id
                       and x.status = 'active' and not x.hidden and x.expires_at > now()),
      'mine', i.seller_id is not distinct from v_me, 'expired', i.expires_at <= now())
    into v
    from public.services_items i join public.services_signups s on s.id = i.seller_id
   where i.id = p_id and (i.seller_id = v_me or public.services_is_admin()
                          or (i.status in ('active', 'sold') and not i.hidden));
  if v is not null and not (v ->> 'mine')::boolean then
    update public.services_items set views = views + 1 where id = p_id;
  end if;
  return v;
end;
$fn$;

create or replace function public.services_item_reveal(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_phone text;
  v_wa boolean;
begin
  if v_me is null then return public.services_item_no('sign_in_required'); end if;
  if (select count(*) from public.services_item_reveals
       where viewer_id = v_me and at > now() - interval '1 day') >= 40 then
    return public.services_item_no('rate_limited'); end if;
  select s.phone, i.whatsapp into v_phone, v_wa
    from public.services_items i join public.services_signups s on s.id = i.seller_id
   where i.id = p_id and i.status = 'active' and not i.hidden and i.expires_at > now();
  if v_phone is null then return public.services_item_no('gone'); end if;
  insert into public.services_item_reveals (item_id, viewer_id) values (p_id, v_me);
  return jsonb_build_object('ok', true, 'whatsapp', v_wa,
                            'phone', '+' || regexp_replace(v_phone, '\D', '', 'g'));
end;
$fn$;

grant execute on function public.services_item_get(uuid) to anon, authenticated;
revoke all on function public.services_item_reveal(uuid) from public, anon;
grant execute on function public.services_item_reveal(uuid) to authenticated;


notify pgrst, 'reload schema';
select 'part 5 done' as "84_part5";
