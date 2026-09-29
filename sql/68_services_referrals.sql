-- ===========================================================================
-- 68_services_referrals.sql
--
-- "Bring somebody onto Dhundo, get ₹3 when they are published."
--
-- THE RULE, EXACTLY
--   * The person who joins gets ₹5. That is the welcome bonus from 66 --
--     they were getting it anyway. A referral does NOT add to it, so nobody
--     ends up on ₹10 and the reward for signing up is the same for everyone.
--   * The person who referred them gets ₹3, ONCE, and only when an admin
--     approves the new person's listing.
--
-- ---------------------------------------------------------------------------
-- WHY PAYMENT WAITS FOR APPROVAL
-- ---------------------------------------------------------------------------
-- Referral bonuses are the most reliably abused feature in consumer apps,
-- and Dhundo is unusually exposed: sign-up is a phone number and a PIN with
-- no OTP, so accounts are free to manufacture. Paying on sign-up would be a
-- cash machine. Paying on "they made a listing" is better but still
-- scriptable -- a mason listing needs a name and an area.
--
-- Paying on APPROVAL puts a human between the fraud and the money. Every ₹3
-- corresponds to a listing somebody looked at in the admin screen and chose
-- to publish. That does not make fraud impossible, but it caps it at the
-- rate a person can be fooled, one listing at a time, rather than the rate a
-- script can POST.
--
-- WHAT IS STILL POSSIBLE, so it is not a surprise later:
--   * Real-looking listings for people who do not exist, approved because
--     they read well. The defence is the admin screen, not this file.
--   * One person referring their own second account. Self-referral by the
--     SAME account is blocked below; a different phone is not detectable
--     here, and at ₹3 with a manual review in the way it is not worth
--     building more than the audit trail that already exists.
--
-- Every payment is a ledger row naming who it was for, so if a pattern
-- appears it can be found and reversed with a correcting row.
-- ===========================================================================

do $$
begin
  if to_regclass('public.services_wallet_entries') is null then
    raise exception 'Run 66 first.';
  end if;
  if to_regclass('public.services_workers') is null then
    raise exception 'Run 55 through 67 first.';
  end if;
end $$;

-- ===========================================================================
-- THE LEDGER LEARNS WHO A ROW IS ABOUT
--
-- A referrer earns many ₹3s -- one per person they bring. So "has this been
-- paid" cannot be answered by (account, kind) the way the signup bonus was.
-- It needs to be (account, kind, WHICH PERSON), and that is what this column
-- is for. It also makes the history readable: "₹3 for Bikash" rather than
-- three identical rows.
-- ===========================================================================
alter table public.services_wallet_entries
  add column if not exists ref_account_id uuid references public.services_signups(id) on delete set null;

alter table public.services_wallet_entries
  drop constraint if exists services_wallet_kind_known;
alter table public.services_wallet_entries
  add constraint services_wallet_kind_known
  check (kind in ('signup_bonus', 'promo', 'adjustment', 'refund', 'referral'));

-- One payment per (referrer, referred person), enforced by the database
-- rather than by a check in a function. Pressing Publish twice, or hiding a
-- listing and publishing it again, must not pay twice -- and both of those
-- WILL happen, because that is what admin screens are for.
create unique index if not exists services_wallet_one_referral
  on public.services_wallet_entries (account_id, ref_account_id)
  where kind = 'referral';

-- ===========================================================================
-- CODES
-- ===========================================================================
alter table public.services_signups
  add column if not exists referral_code text,
  add column if not exists referred_by   uuid references public.services_signups(id) on delete set null,
  add column if not exists referred_at   timestamptz;

create unique index if not exists services_signups_referral_code_key
  on public.services_signups (referral_code)
  where referral_code is not null;

create index if not exists services_signups_referred_by_idx
  on public.services_signups (referred_by)
  where referred_by is not null;

-- Six characters from an alphabet with no 0/O, 1/I/L, 5/S, 8/B. This code
-- gets read aloud down a phone line and written on the back of a receipt;
-- every ambiguous glyph is a support message. 26 possibilities to the sixth
-- is about 300 million, which is enough forever at this scale.
create or replace function public.services_make_referral_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ACDEFGHJKMNPQRTUVWXYZ23479';
  v_code text;
  i int;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.services_signups s where s.referral_code = v_code
    );
    -- Collisions at this size are vanishingly rare; the loop exists so that
    -- "vanishingly rare" never becomes "a failed sign-up".
  end loop;
  return v_code;
end;
$$;

create or replace function public.services_set_referral_code()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.referral_code is null then
    new.referral_code := public.services_make_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists services_signups_referral_code on public.services_signups;
create trigger services_signups_referral_code
  before insert on public.services_signups
  for each row execute function public.services_set_referral_code();

-- Everybody who already has an account gets one, so an existing user can
-- start inviting the moment this deploys.
update public.services_signups
   set referral_code = public.services_make_referral_code()
 where referral_code is null;

-- ===========================================================================
-- CLAIMING A CODE
--
-- Called by the app straight after sign-up. The caller is the NEW person,
-- read from their token -- there is no "who am I" parameter, for the reason
-- 59 had to remove one from services_reveal_contact().
-- ===========================================================================
create or replace function public.services_apply_referral(p_code text)
returns table (ok boolean, reason text, referrer_name text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me       uuid := public.services_account_id();
  v_code     text := upper(btrim(coalesce(p_code, '')));
  v_ref      public.services_signups%rowtype;
  v_mine     public.services_signups%rowtype;
begin
  if v_me is null then
    return query select false, 'not_signed_in'::text, null::text; return;
  end if;
  if v_code = '' then
    return query select false, 'no_code'::text, null::text; return;
  end if;

  select * into v_mine from public.services_signups where id = v_me;

  -- Set once and never again. Otherwise somebody swaps the code the day
  -- before approval and the ₹3 goes to whoever asked most recently.
  if v_mine.referred_by is not null then
    return query select false, 'already_referred'::text, null::text; return;
  end if;

  select * into v_ref from public.services_signups where referral_code = v_code;
  if not found then
    return query select false, 'bad_code'::text, null::text; return;
  end if;

  -- Your own code. The obvious attempt, and the only self-referral this
  -- function can actually see -- a second account on a second phone is
  -- indistinguishable from a real friend, which is why the money waits for
  -- a human to approve the listing.
  if v_ref.id = v_me then
    return query select false, 'self_referral'::text, null::text; return;
  end if;

  -- Too late once you are already published: the referral is meant to bring
  -- somebody new, not to be attached to a listing that already went through.
  if exists (
    select 1 from public.services_workers w
     where w.user_id = v_me and w.status = 'approved'
  ) then
    return query select false, 'too_late'::text, null::text; return;
  end if;

  update public.services_signups
     set referred_by = v_ref.id, referred_at = now()
   where id = v_me;

  return query select true, 'linked'::text, v_ref.full_name::text;
end;
$$;

revoke all on function public.services_apply_referral(text) from public, anon, authenticated;
grant execute on function public.services_apply_referral(text) to authenticated;

-- ===========================================================================
-- WHAT THE INVITER SEES
-- ===========================================================================
create or replace function public.services_my_referrals()
returns table (
  code text, invited int, published int, earned_paise bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    s.referral_code::text,
    (select count(*)::int from public.services_signups r where r.referred_by = s.id),
    -- "Published" is what actually pays, so it is counted separately: an
    -- inviter with 9 invited and 0 published should be able to see that
    -- rather than wonder where the money is.
    (select count(*)::int from public.services_signups r
       join public.services_workers w on w.user_id = r.id
      where r.referred_by = s.id and w.status = 'approved'),
    (select coalesce(sum(e.amount_paise), 0)::bigint
       from public.services_wallet_entries e
      where e.account_id = s.id and e.kind = 'referral')
  from public.services_signups s
  where s.id = public.services_account_id();
$$;

revoke all on function public.services_my_referrals() from public, anon, authenticated;
grant execute on function public.services_my_referrals() to authenticated;

-- ===========================================================================
-- THE PAYOUT
--
-- Deliberately its own function rather than eight lines inside
-- services_admin_set_status: it is the only thing in this project that
-- creates money from an action, and it should be readable on its own.
--
-- Returns the paise paid so a caller can tell "paid ₹3" from "nothing to do",
-- which is the difference between a working feature and a silent one.
-- ===========================================================================
create or replace function public.services_pay_referral(p_worker_id uuid)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account  uuid;
  v_referrer uuid;
  v_amount   bigint := 300;   -- ₹3. The signup bonus lives in 66; this is its own.
begin
  select w.user_id into v_account
    from public.services_workers w
   where w.id = p_worker_id;

  -- A listing an admin typed in by hand has no account behind it, so there
  -- is nobody to have referred them.
  if v_account is null then
    return 0;
  end if;

  select s.referred_by into v_referrer
    from public.services_signups s
   where s.id = v_account;

  if v_referrer is null or v_referrer = v_account then
    return 0;
  end if;

  -- ON CONFLICT, not a prior check: the unique index is what makes this
  -- correct under a double-click, and this clause is what stops the second
  -- press raising an error in the admin's face.
  insert into public.services_wallet_entries
    (account_id, amount_paise, kind, note, ref_account_id)
  values
    (v_referrer, v_amount, 'referral',
     (select 'For ' || coalesce(nullif(btrim(s.full_name), ''), 'someone you invited')
        from public.services_signups s where s.id = v_account),
     v_account)
  on conflict do nothing;

  if not found then
    return 0;   -- already paid for this person
  end if;
  return v_amount;
end;
$$;

revoke all on function public.services_pay_referral(uuid) from public, anon, authenticated;
-- Nobody calls this directly. It runs inside services_admin_set_status,
-- which is already admin-gated; granting it to authenticated would let any
-- signed-in person trigger a payment.

-- ===========================================================================
-- APPROVAL PAYS THE REFERRER
--
-- 67's function, with one call added. Signature and return type unchanged,
-- so CREATE OR REPLACE is safe and no overload appears. The gate and the
-- ID-destruction block are carried over verbatim.
-- ===========================================================================
create or replace function public.services_admin_set_status(
  p_worker_id uuid,
  p_status    text,
  p_verified  boolean default null
)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_path text;
  v_gaps text[];
  v_paid bigint := 0;
begin
  if not public.services_is_admin() then
    return query select false, 'not_admin'::text; return;
  end if;
  if p_status not in ('pending','approved','hidden') then
    return query select false, 'bad_status'::text; return;
  end if;

  if not exists (select 1 from public.services_workers where id = p_worker_id) then
    return query select false, 'not_found'::text; return;
  end if;

  if p_status = 'approved' then
    v_gaps := public.services_listing_gaps(p_worker_id);
    if array_length(v_gaps, 1) > 0 then
      return query select false, ('missing:' || array_to_string(v_gaps, ','))::text;
      return;
    end if;
  end if;

  select id_doc_path into v_path from public.services_workers where id = p_worker_id;

  update public.services_workers
     set status     = p_status,
         verified   = coalesce(p_verified, verified),
         updated_at = now()
   where id = p_worker_id;

  -- AFTER the update, so a failed approval never pays, and only on the way
  -- to 'approved'. Hiding somebody does not claw the ₹3 back: the inviter
  -- did their part, and taking money back for a later moderation decision
  -- would be its own kind of unfair. A correcting row is the way to undo it
  -- deliberately.
  if p_status = 'approved' then
    v_paid := public.services_pay_referral(p_worker_id);
  end if;

  if coalesce(p_verified, false) and v_path is not null then
    delete from storage.objects where bucket_id = 'services-ids' and name = v_path;
    update public.services_workers
       set id_doc_path = null, id_doc_uploaded_at = null
     where id = p_worker_id;
  end if;

  -- 'ok' or 'ok_paid_referral', so the admin screen can say the ₹3 went out.
  return query select true, (case when v_paid > 0 then 'ok_paid_referral' else 'ok' end)::text;
end;
$$;

revoke all on function public.services_admin_set_status(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.services_admin_set_status(uuid, text, boolean) to authenticated;

-- ===========================================================================
-- THE WALLET HISTORY CARRIES THE NAME
-- ===========================================================================
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
-- VERIFY
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'ref_column_on_ledger', (select count(*) from information_schema.columns
                            where table_schema='public' and table_name='services_wallet_entries'
                              and column_name='ref_account_id'),
  'signup_columns', (select count(*) from information_schema.columns
                      where table_schema='public' and table_name='services_signups'
                        and column_name in ('referral_code','referred_by','referred_at')),
  'code_trigger', (select count(*) from pg_trigger
                    where tgrelid='public.services_signups'::regclass
                      and tgname='services_signups_referral_code' and not tgisinternal),
  'one_referral_index', (select count(*) from pg_indexes
                          where schemaname='public' and indexname='services_wallet_one_referral'),
  'accounts', (select count(*) from public.services_signups),
  'accounts_with_code', (select count(*) from public.services_signups where referral_code is not null),
  'duplicate_codes', (select count(*) from (
                        select referral_code from public.services_signups
                         where referral_code is not null
                         group by referral_code having count(*) > 1) d),
  'pay_referral_granted_to_clients', (select count(*) from information_schema.role_routine_grants
                                       where routine_schema='public'
                                         and routine_name='services_pay_referral'
                                         and grantee in ('anon','authenticated')),
  'apply_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                       where n.nspname='public' and p.proname='services_apply_referral'),
  'set_status_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                            where n.nspname='public' and p.proname='services_admin_set_status'),
  'history_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public' and p.proname='services_wallet_history'),
  'expected', 'ref_column_on_ledger 1; signup_columns 3; code_trigger 1; one_referral_index 1; accounts_with_code = accounts; duplicate_codes 0; pay_referral_granted_to_clients 0; every overload count 1'
)) as "68_verify";
