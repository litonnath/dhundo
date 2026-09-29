-- ===========================================================================
-- 66_services_wallet.sql
--
-- A wallet for Dhundo accounts, and a ₹5 credit when somebody signs up.
--
-- ---------------------------------------------------------------------------
-- READ THIS BEFORE MAKING THE BALANCE SPENDABLE
-- ---------------------------------------------------------------------------
-- Today this balance buys nothing and cannot be withdrawn. That is the only
-- reason the signup bonus is safe to hand out unconditionally: sign-up on
-- Dhundo is a phone number and a 6-digit PIN with NO verification that the
-- person owns the number -- no OTP, and the email address is synthetic. A
-- script with a list of plausible numbers can make accounts as fast as the
-- network allows. While an account is worth a number on a screen, nobody
-- bothers. The day it is worth ₹5 of anything real, somebody will, and they
-- will do it all at once rather than gradually.
--
-- So before ANY of these become true:
--
--   * the balance pays for something (a contact reveal, a listing boost)
--   * the balance can be withdrawn to UPI or a bank account
--   * the balance can be transferred between accounts
--
-- two things have to happen first:
--
--   1. SMS OTP on sign-up, so an account costs a real phone number. Until
--      then the bonus is a faucet with no tap.
--   2. A look at the RBI's prepaid payment instrument rules. Stored value
--      that a user can take OUT as cash needs authorisation and KYC. Credit
--      that can only be spent inside Dhundo does not. That line is the whole
--      difference between a feature and a regulated product, and it is not a
--      line to cross by accident while adding a "withdraw" button.
--
-- This file deliberately contains no debit path, no transfer and no payout.
-- Adding one is a decision, not a refactor.
--
-- ---------------------------------------------------------------------------
-- WHY A LEDGER AND NOT A BALANCE COLUMN
-- ---------------------------------------------------------------------------
-- The obvious design is `balance` on services_signups, updated as money moves.
-- It is obvious and it is wrong: the moment a balance looks incorrect there is
-- no way to find out how it got that way, because each update destroys the
-- previous answer. Every real accounting system in existence writes rows and
-- adds them up instead, and the cost of doing that here is one sum().
--
-- So: services_wallet_entries is append-only. No UPDATE path exists for it,
-- for anyone, including an admin. A mistake is corrected by writing a second,
-- opposite row -- which leaves both the mistake and the correction visible.
--
-- ---------------------------------------------------------------------------
-- WHY PAISE AND NOT RUPEES
-- ---------------------------------------------------------------------------
-- amount_paise is a bigint. ₹5 is 500. Money in a float is the classic way to
-- end up with a balance of ₹4.999999999999999, and numeric would work but
-- invites somebody to store ₹0.001 later. An integer count of the smallest
-- real unit cannot drift.
-- ===========================================================================

-- Safe to run more than once, and it will be: every statement below is
-- guarded. 59 claimed this in its header and then failed on re-run at an
-- `add constraint`, so the claim here is tested rather than asserted.

do $$
begin
  if to_regclass('public.services_signups') is null then
    raise exception 'services_signups does not exist -- run 59 first.';
  end if;
end $$;

-- ===========================================================================
-- THE LEDGER
-- ===========================================================================
create table if not exists public.services_wallet_entries (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.services_signups(id) on delete cascade,
  -- Signed. A credit is positive, a debit negative. There is no debit path
  -- yet; the column allows one so that adding it later does not need a
  -- migration of existing rows.
  amount_paise bigint not null,
  -- What this row is. Kept as free text with a check rather than an enum:
  -- adding a value to an enum in Postgres is a schema change, and the set of
  -- reasons money moves will grow.
  kind         text not null,
  -- For a human reading the history later, and for an admin explaining an
  -- adjustment. Shown to the account holder, so no internal notes here.
  note         text,
  created_at   timestamptz not null default now(),
  constraint services_wallet_kind_known
    check (kind in ('signup_bonus', 'promo', 'adjustment', 'refund')),
  -- A zero-value row is always a mistake, never a deliberate act.
  constraint services_wallet_amount_nonzero check (amount_paise <> 0)
);

create index if not exists services_wallet_entries_account_idx
  on public.services_wallet_entries (account_id, created_at desc);

-- THE THING THAT ACTUALLY STOPS DOUBLE-CREDITING.
--
-- Not an `if not exists` check in the function -- two concurrent sign-ups for
-- the same account would both look, both find nothing, and both insert. The
-- database refuses the second one regardless of timing.
--
-- services_signup_link() is called on sign-UP and again on sign-IN when an
-- account has no services_signups row (auth.jsx recovers a half-finished
-- sign-up that way). Without this index that recovery path would hand out a
-- second ₹5 every time somebody signed in after a failed sign-up.
create unique index if not exists services_wallet_one_signup_bonus
  on public.services_wallet_entries (account_id)
  where kind = 'signup_bonus';

-- ===========================================================================
-- LOCKED DOWN
--
-- No direct access at all, for anybody. Every read goes through a definer
-- function below, and the only write is the trigger. A table that nobody can
-- INSERT into cannot have money invented in it by a crafted PostgREST call.
-- ===========================================================================
alter table public.services_wallet_entries enable row level security;
revoke all on public.services_wallet_entries from public, anon, authenticated;

-- No policy is created on purpose. RLS with no policy denies everything,
-- which is exactly right here: the definer functions bypass it, and nothing
-- else should reach this table.

-- ===========================================================================
-- THE SIGNUP BONUS
--
-- A trigger on services_signups rather than an edit to services_signup_link().
-- Two reasons:
--
--   * services_signup_link() is not the only way a row can appear here. An
--     admin inserting an account by hand, a future import, a second sign-up
--     path -- all of them should credit the bonus, and none of them would if
--     the insert lived inside one function.
--   * Changing that function's body risks its return type, and a changed
--     return type needs a DROP first (42P13). Rewriting it from memory is
--     how 57's columns went missing once. Not touching it is safer.
-- ===========================================================================

-- ₹5.00. One place, changed here and nowhere else. Kept as a function rather
-- than a literal in the trigger so that changing the promo does not mean
-- reading trigger source to find the number.
create or replace function public.services_signup_bonus_paise()
returns bigint
language sql
immutable
as $$ select 500::bigint $$;

create or replace function public.services_grant_signup_bonus()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_amount bigint := public.services_signup_bonus_paise();
begin
  if v_amount <= 0 then
    return new;
  end if;

  -- ON CONFLICT rather than a prior existence check: the unique partial index
  -- is what makes this correct, and this clause is what stops it raising.
  -- A trigger that throws here would take the whole sign-up down with it --
  -- somebody would be unable to create an account because of a free gift.
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note)
  values (new.id, v_amount, 'signup_bonus', 'Welcome bonus')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists services_signups_signup_bonus on public.services_signups;
create trigger services_signups_signup_bonus
  after insert on public.services_signups
  for each row execute function public.services_grant_signup_bonus();

-- ===========================================================================
-- READING IT
--
-- Balance and history are the caller's OWN and nobody else's: both derive the
-- account from services_account_id(), which reads auth.uid() out of the signed
-- token. There is no p_account_id parameter, deliberately -- 59 had to remove
-- exactly that from services_reveal_contact() after it turned out any signed-in
-- person could pass somebody else's id.
-- ===========================================================================
create or replace function public.services_wallet_balance()
returns bigint
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(e.amount_paise), 0)::bigint
    from public.services_wallet_entries e
   where e.account_id = public.services_account_id();
$$;

revoke all on function public.services_wallet_balance() from public, anon, authenticated;
grant execute on function public.services_wallet_balance() to authenticated;

drop function if exists public.services_wallet_history(int);

create or replace function public.services_wallet_history(p_limit int default 50)
returns table (
  id uuid, amount_paise bigint, kind text, note text, created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select e.id, e.amount_paise, e.kind, e.note, e.created_at
    from public.services_wallet_entries e
   where e.account_id = public.services_account_id()
   order by e.created_at desc, e.id desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.services_wallet_history(int) from public, anon, authenticated;
grant execute on function public.services_wallet_history(int) to authenticated;

-- ===========================================================================
-- ADMIN: ADDING CREDIT BY HAND
--
-- For a promo, or to put right something that went wrong. Admin only, and it
-- writes a row like everything else -- there is no way to set a balance, only
-- to move it. A correction is a second row, not an edit.
-- ===========================================================================
drop function if exists public.services_wallet_credit(uuid, bigint, text, text);

create or replace function public.services_wallet_credit(
  p_account_id uuid,
  p_amount_paise bigint,
  p_kind text default 'adjustment',
  p_note text default null
)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.services_is_admin() then
    return query select false, 'not_admin'::text;
    return;
  end if;
  if p_amount_paise is null or p_amount_paise = 0 then
    return query select false, 'zero_amount'::text;
    return;
  end if;
  -- signup_bonus is the trigger's to write. Allowing an admin to write one by
  -- hand would let a second one exist for an account whose trigger row was
  -- since removed, which is precisely the ambiguity the partial index exists
  -- to prevent.
  if coalesce(p_kind, '') not in ('promo', 'adjustment', 'refund') then
    return query select false, 'bad_kind'::text;
    return;
  end if;
  if not exists (select 1 from public.services_signups s where s.id = p_account_id) then
    return query select false, 'no_account'::text;
    return;
  end if;

  insert into public.services_wallet_entries (account_id, amount_paise, kind, note)
  values (p_account_id, p_amount_paise, p_kind, nullif(trim(coalesce(p_note, '')), ''));

  return query select true, 'credited'::text;
end;
$$;

revoke all on function public.services_wallet_credit(uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.services_wallet_credit(uuid, bigint, text, text) to authenticated;

-- ===========================================================================
-- BACKFILL
--
-- Everybody who signed up before this file existed gets the bonus too. The
-- partial unique index means running this twice credits nobody twice, so it
-- is safe to leave in the migration rather than as a one-off script.
-- ===========================================================================
insert into public.services_wallet_entries (account_id, amount_paise, kind, note)
select s.id, public.services_signup_bonus_paise(), 'signup_bonus', 'Welcome bonus'
  from public.services_signups s
 where public.services_signup_bonus_paise() > 0
on conflict do nothing;

-- ===========================================================================
-- VERIFY
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'ledger_exists', (to_regclass('public.services_wallet_entries') is not null),
  'rls_on', (select relrowsecurity from pg_class
              where oid = 'public.services_wallet_entries'::regclass),
  'policies_on_ledger', (select count(*) from pg_policies
                          where schemaname='public' and tablename='services_wallet_entries'),
  'direct_grants_to_clients', (select count(*) from information_schema.role_table_grants
                                where table_schema='public'
                                  and table_name='services_wallet_entries'
                                  and grantee in ('anon','authenticated')),
  'bonus_trigger', (select count(*) from pg_trigger
                     where tgrelid = 'public.services_signups'::regclass
                       and tgname = 'services_signups_signup_bonus'
                       and not tgisinternal),
  'one_bonus_index', (select count(*) from pg_indexes
                       where schemaname='public'
                         and indexname='services_wallet_one_signup_bonus'),
  'balance_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public' and p.proname='services_wallet_balance'),
  'history_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public' and p.proname='services_wallet_history'),
  'credit_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                        where n.nspname='public' and p.proname='services_wallet_credit'),
  'accounts', (select count(*) from public.services_signups),
  'accounts_with_bonus', (select count(*) from public.services_wallet_entries
                           where kind='signup_bonus'),
  'expected', 'ledger_exists true; rls_on true; policies_on_ledger 0; direct_grants_to_clients 0; bonus_trigger 1; one_bonus_index 1; every overload count 1; accounts_with_bonus = accounts'
)) as "66_verify";
