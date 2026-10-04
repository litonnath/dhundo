-- ===========================================================================
-- 109_part2.sql -- run after 109_part1.sql.
-- After a person checks their phone, pay what was waiting: the listing bonus
-- for their own approved listing, and the referral for whoever invited them.
-- Each is paid once (the ledger refuses a second).
-- ===========================================================================
create or replace function public.services_claim_rewards()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  w record;
  v_bonus bigint := 0;
  v_ref bigint := 0;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in_required');
  end if;
  perform public.services_rate_guard('claim', v_me::text, 20, 3600);
  if not public.services_account_phone_ok(v_me) then
    return jsonb_build_object('ok', false, 'reason', 'phone_not_verified');
  end if;
  for w in select id from public.services_workers where user_id = v_me and status = 'approved' loop
    v_bonus := v_bonus + public.services_pay_listing_bonus(w.id);
    v_ref := v_ref + public.services_pay_referral(w.id);
  end loop;
  return jsonb_build_object('ok', true, 'bonus_paise', v_bonus, 'referral_paise', v_ref);
end;
$fn$;
revoke all on function public.services_claim_rewards() from public, anon;
grant execute on function public.services_claim_rewards() to authenticated;

notify pgrst, 'reload schema';
select 'done' as "109_part2";
