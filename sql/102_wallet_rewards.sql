-- ===========================================================================
-- 102_wallet_rewards.sql   (needs 66 and 68)
--
-- Replaces the Rs 5 welcome credit at sign-up with:
--   * Rs 20 to a person when their own listing is approved and published
--   * Rs 10 to whoever referred them, at that same moment (was Rs 3)
-- Each is paid once per person, by a trigger on the listing's status, so it
-- does not matter which screen or admin action approves the listing.
--
-- Accounts that already received the Rs 5 sign-up credit keep it.
-- The balance still cannot be spent or withdrawn (see the note in 66).
-- ===========================================================================
do $$
begin
  if to_regclass('public.services_wallet_entries') is null then raise exception 'Run 66 first.'; end if;
  if to_regclass('public.services_workers') is null then raise exception 'Run 55 through 68 first.'; end if;
end $$;

-- No credit at sign-up any more.
create or replace function public.services_signup_bonus_paise()
returns bigint language sql immutable as $$ select 0::bigint $$;

alter table public.services_wallet_entries drop constraint if exists services_wallet_kind_known;
alter table public.services_wallet_entries
  add constraint services_wallet_kind_known
  check (kind in ('signup_bonus', 'promo', 'adjustment', 'refund', 'referral', 'listing_bonus'));

create unique index if not exists services_wallet_one_listing_bonus
  on public.services_wallet_entries (account_id) where kind = 'listing_bonus';

-- The amounts live in one place each.
create or replace function public.services_listing_bonus_paise()
returns bigint language sql immutable as $$ select 2000::bigint $$;
create or replace function public.services_referral_paise()
returns bigint language sql immutable as $$ select 1000::bigint $$;

-- Rs 20 to the person whose listing it is. Once per account.
create or replace function public.services_pay_listing_bonus(p_worker_id uuid)
returns bigint
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_account uuid;
  v_amount  bigint := public.services_listing_bonus_paise();
begin
  select w.user_id into v_account from public.services_workers w where w.id = p_worker_id;
  if v_account is null then return 0; end if;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note)
  values (v_account, v_amount, 'listing_bonus', 'Listing published')
  on conflict do nothing;
  if not found then return 0; end if;
  return v_amount;
end;
$$;
revoke all on function public.services_pay_listing_bonus(uuid) from public, anon, authenticated;

-- Rs 10 (was 3) to the referrer. Same rules as before: once per person.
create or replace function public.services_pay_referral(p_worker_id uuid)
returns bigint
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_account  uuid;
  v_referrer uuid;
  v_amount   bigint := public.services_referral_paise();
begin
  select w.user_id into v_account from public.services_workers w where w.id = p_worker_id;
  if v_account is null then return 0; end if;
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
$$;
revoke all on function public.services_pay_referral(uuid) from public, anon, authenticated;

-- Fires when a listing becomes approved, however that happens.
create or replace function public.services_pay_on_approval()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    perform public.services_pay_listing_bonus(new.id);
    perform public.services_pay_referral(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists services_workers_pay_on_approval on public.services_workers;
create trigger services_workers_pay_on_approval
  after insert or update of status on public.services_workers
  for each row execute function public.services_pay_on_approval();

-- NOT done here: paying Rs 20 to listings that were approved before today.
-- To do it deliberately, run once:
--   select public.services_pay_listing_bonus(id) from public.services_workers where status = 'approved';

select 'done' as "102_wallet_rewards";
