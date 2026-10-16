-- 249_monthly_1.sql -- Rs 10 sign-up bonus + monthly credit. Part 1 of 2. Needs 225.
-- Sign-up bonus is Rs 10 again (the trigger from 66 pays it, once per account).
create or replace function public.services_signup_bonus_paise()
returns bigint language sql immutable as $$ select 1000::bigint $$;
alter table public.services_wallet_entries drop constraint if exists services_wallet_kind_known;
alter table public.services_wallet_entries add constraint services_wallet_kind_known
  check (kind in ('signup_bonus', 'promo', 'adjustment', 'refund', 'referral', 'listing_bonus', 'withdrawal', 'earning', 'topup', 'spend', 'settlement', 'monthly_bonus'));
-- One monthly credit per person per month: ref holds the month, the index refuses a second.
create unique index if not exists services_wallet_one_monthly
  on public.services_wallet_entries (account_id, ref) where kind = 'monthly_bonus';
select 'done' as "249_monthly_1";
