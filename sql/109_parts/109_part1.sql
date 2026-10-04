-- ===========================================================================
-- 109_part1.sql -- money is paid only to a phone number that has been checked
-- with a one-time code. Needs 102 and 103_parts.
--
-- A person signs in with the phone and a PIN as before. Checking the phone
-- (a code sent by SMS, done once, from the wallet) marks the sign-in account
-- as having a confirmed phone. Rewards and withdrawals need that mark, so a
-- script making accounts with numbers it does not own gets nothing.
-- ===========================================================================
create or replace function public.services_account_phone_ok(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select coalesce((
    select u.phone_confirmed_at is not null
           and right(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g'), 10)
             = right(regexp_replace(coalesce(s.phone, ''), '\D', '', 'g'), 10)
      from public.services_signups s
      join auth.users u on u.id = s.auth_user_id
     where s.id = p_account
  ), false);
$fn$;
revoke all on function public.services_account_phone_ok(uuid) from public, anon, authenticated;

create or replace function public.services_phone_verified()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select public.services_account_phone_ok(public.services_account_id());
$fn$;
revoke all on function public.services_phone_verified() from public, anon;
grant execute on function public.services_phone_verified() to authenticated;

-- Rs 20 to the person whose listing it is: only once the phone is checked.
create or replace function public.services_pay_listing_bonus(p_worker_id uuid)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_account uuid;
  v_amount  bigint := public.services_listing_bonus_paise();
begin
  select w.user_id into v_account from public.services_workers w where w.id = p_worker_id;
  if v_account is null then return 0; end if;
  if not public.services_account_phone_ok(v_account) then return 0; end if;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note)
  values (v_account, v_amount, 'listing_bonus', 'Listing published')
  on conflict do nothing;
  if not found then return 0; end if;
  return v_amount;
end;
$fn$;
revoke all on function public.services_pay_listing_bonus(uuid) from public, anon, authenticated;

-- Rs 10 to the referrer: only when the person they invited has a checked phone.
create or replace function public.services_pay_referral(p_worker_id uuid)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_account  uuid;
  v_referrer uuid;
  v_amount   bigint := public.services_referral_paise();
begin
  select w.user_id into v_account from public.services_workers w where w.id = p_worker_id;
  if v_account is null then return 0; end if;
  if not public.services_account_phone_ok(v_account) then return 0; end if;
  select s.referred_by into v_referrer from public.services_signups s where s.id = v_account;
  if v_referrer is null or v_referrer = v_account then return 0; end if;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref_account_id)
  values (v_referrer, v_amount, 'referral',
          (select 'For ' || coalesce(nullif(btrim(s.full_name), ''), 'someone you invited')
             from public.services_signups s where s.id = v_account),
          v_account)
  on conflict do nothing;
  if not found then return 0; end if;
  return v_amount;
end;
$fn$;
revoke all on function public.services_pay_referral(uuid) from public, anon, authenticated;

-- Withdrawals need a checked phone too.
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
select 'part 1 of 2 done' as "109_part1";
