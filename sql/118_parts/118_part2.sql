-- ===========================================================================
-- 118_part2.sql -- a signed-in person turns alerts on or off for this phone.
-- ===========================================================================
create or replace function public.services_push_subscribe(
  p_endpoint text, p_p256dh text, p_auth text, p_lang text default 'en')
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null or length(coalesce(p_endpoint, '')) < 20 or p_endpoint not like 'https://%' then
    return query select false;
    return;
  end if;
  perform public.services_rate_guard('push_sub', v_me::text, 20, 86400);
  insert into public.services_push_subs (user_id, endpoint, p256dh, auth, lang)
  values (v_me, p_endpoint, p_p256dh, p_auth, left(coalesce(p_lang, 'en'), 5))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang;
  return query select true;
end;
$fn$;
revoke all on function public.services_push_subscribe(text, text, text, text) from public, anon, authenticated;
grant execute on function public.services_push_subscribe(text, text, text, text) to authenticated;

create or replace function public.services_push_unsubscribe(p_endpoint text)
returns table (ok boolean)
language sql
security definer
set search_path to 'public'
as $fn$
  with d as (delete from public.services_push_subs
              where endpoint = p_endpoint and user_id = public.services_account_id() returning 1)
  select exists (select 1 from d);
$fn$;
revoke all on function public.services_push_unsubscribe(text) from public, anon, authenticated;
grant execute on function public.services_push_unsubscribe(text) to authenticated;

select 'part 2 of 6 done' as "118_part2";
