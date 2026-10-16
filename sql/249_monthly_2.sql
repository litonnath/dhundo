-- 249_monthly_2.sql -- Part 2 of 2. Run 249_monthly_1 first.
-- Credits this month's bonus to the signed-in person when they open the app:
-- Rs 50 if they own a live (approved) listing, otherwise Rs 10. Once per calendar
-- month (IST); a second call the same month does nothing. Returns the paise credited.
create or replace function public.services_claim_monthly_bonus()
returns bigint
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_account uuid := public.services_account_id();
  v_owner   boolean;
  v_amount  bigint;
  v_month   text := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM');
begin
  if v_account is null then return 0; end if;
  if not exists (select 1 from public.services_signups s where s.id = v_account) then return 0; end if;
  select exists (select 1 from public.services_workers w where w.user_id = v_account and w.status = 'approved') into v_owner;
  v_amount := case when v_owner then 5000 else 1000 end;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
  values (v_account, v_amount, 'monthly_bonus', 'Monthly bonus', v_month)
  on conflict do nothing;
  if not found then return 0; end if;
  return v_amount;
end;
$fn$;
revoke all on function public.services_claim_monthly_bonus() from public, anon;
grant execute on function public.services_claim_monthly_bonus() to authenticated;
select 'done' as "249_monthly_2";
