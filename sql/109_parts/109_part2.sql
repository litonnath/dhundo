-- 109_part2.sql: pays the listing bonus and the referral only to a checked phone.

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

notify pgrst, 'reload schema';
select 'part 2 of 4 done' as "109_part2";
