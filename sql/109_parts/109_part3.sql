-- 109_part3.sql: withdrawals need a checked phone too.

create or replace function public.services_withdraw_request(p_upi text)
returns table (ok boolean, reason text, amount_paise bigint)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me  uuid := public.services_account_id();
  v_upi text := lower(btrim(coalesce(p_upi, '')));
  v_bal bigint;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text, 0::bigint;
    return;
  end if;
  perform public.services_rate_guard('withdraw', v_me::text, 5, 86400);
  if not public.services_account_phone_ok(v_me) then
    return query select false, 'phone_not_verified'::text, 0::bigint;
    return;
  end if;
  if v_upi !~ '^[a-z0-9._-]{2,64}@[a-z][a-z0-9.-]{1,30}$' then
    return query select false, 'bad_upi'::text, 0::bigint;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_me::text, 0));
  if exists (select 1 from public.services_withdrawals w where w.account_id = v_me and w.status = 'requested') then
    return query select false, 'already_open'::text, 0::bigint;
    return;
  end if;
  select coalesce(sum(e.amount_paise), 0)::bigint into v_bal
    from public.services_wallet_entries e where e.account_id = v_me;
  if v_bal < public.services_withdraw_min_paise() then
    return query select false, 'below_minimum'::text, v_bal;
    return;
  end if;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note)
  values (v_me, -v_bal, 'withdrawal', 'Withdrawal to ' || v_upi);
  insert into public.services_withdrawals (account_id, amount_paise, upi_id)
  values (v_me, v_bal, v_upi);
  return query select true, 'requested'::text, v_bal;
end;
$fn$;
revoke all on function public.services_withdraw_request(text) from public, anon, authenticated;
grant execute on function public.services_withdraw_request(text) to authenticated;

notify pgrst, 'reload schema';
select 'part 3 of 4 done' as "109_part3";
