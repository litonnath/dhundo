-- ===========================================================================
-- 103_withdrawals.sql   (needs 66, 68, 93 and 102)
--
-- Withdrawals, from Rs 500. A person asks; the amount leaves the wallet at
-- once (a negative ledger row, so it cannot be asked for twice) and waits for
-- you to pay it to their UPI id by hand. If you reject it, the amount goes
-- back to their wallet. Nothing is paid out automatically.
--
-- Rules enforced here, not in the app:
--   * balance must be at least Rs 500; the whole balance is requested
--   * only one open request per account
--   * UPI id must look like name@bank
--   * 5 requests a day per account at most
--
-- Paying:   select * from services_withdrawals where status = 'requested';
--           (pay by UPI, then)
--           select * from services_admin_withdrawal_set('<id>', 'paid', 'UTR 1234');
-- Refusing: select * from services_admin_withdrawal_set('<id>', 'rejected', 'reason');
-- The reason is shown to the person next to their request.
-- ===========================================================================
do $$
begin
  if to_regclass('public.services_wallet_entries') is null then raise exception 'Run 66 first.'; end if;
  if to_regprocedure('public.services_rate_guard(text,text,int,int)') is null then raise exception 'Run 93 first.'; end if;
end $$;

alter table public.services_wallet_entries drop constraint if exists services_wallet_kind_known;
alter table public.services_wallet_entries
  add constraint services_wallet_kind_known
  check (kind in ('signup_bonus', 'promo', 'adjustment', 'refund', 'referral', 'listing_bonus', 'withdrawal'));

create table if not exists public.services_withdrawals (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.services_signups(id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  upi_id       text not null,
  status       text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  note         text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);
create unique index if not exists services_withdrawals_one_open
  on public.services_withdrawals (account_id) where status = 'requested';
alter table public.services_withdrawals enable row level security;
revoke all on public.services_withdrawals from public, anon, authenticated;

create or replace function public.services_withdraw_min_paise()
returns bigint language sql immutable as $$ select 50000::bigint $$;

create or replace function public.services_withdraw_request(p_upi text)
returns table (ok boolean, reason text, amount_paise bigint)
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_me  uuid := public.services_account_id();
  v_upi text := lower(btrim(coalesce(p_upi, '')));
  v_bal bigint;
begin
  if v_me is null then return query select false, 'sign_in_required'::text, 0::bigint; return; end if;
  perform public.services_rate_guard('withdraw', v_me::text, 5, 86400);
  if v_upi !~ '^[a-z0-9._-]{2,64}@[a-z][a-z0-9.-]{1,30}$' then
    return query select false, 'bad_upi'::text, 0::bigint; return;
  end if;
  -- One request at a time per account, even from two phones at once.
  perform pg_advisory_xact_lock(hashtextextended(v_me::text, 0));
  if exists (select 1 from public.services_withdrawals w where w.account_id = v_me and w.status = 'requested') then
    return query select false, 'already_open'::text, 0::bigint; return;
  end if;
  select coalesce(sum(e.amount_paise), 0)::bigint into v_bal
    from public.services_wallet_entries e where e.account_id = v_me;
  if v_bal < public.services_withdraw_min_paise() then
    return query select false, 'below_minimum'::text, v_bal; return;
  end if;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note)
  values (v_me, -v_bal, 'withdrawal', 'Withdrawal to ' || v_upi);
  insert into public.services_withdrawals (account_id, amount_paise, upi_id)
  values (v_me, v_bal, v_upi);
  return query select true, 'requested'::text, v_bal;
end;
$$;
revoke all on function public.services_withdraw_request(text) from public, anon, authenticated;
grant execute on function public.services_withdraw_request(text) to authenticated;

create or replace function public.services_my_withdrawals()
returns table (id uuid, amount_paise bigint, upi_id text, status text, note text, created_at timestamptz)
language sql stable security definer set search_path to 'public'
as $$
  select w.id, w.amount_paise, w.upi_id, w.status, w.note, w.created_at
    from public.services_withdrawals w
   where w.account_id = public.services_account_id()
   order by w.created_at desc limit 10;
$$;
revoke all on function public.services_my_withdrawals() from public, anon, authenticated;
grant execute on function public.services_my_withdrawals() to authenticated;

create or replace function public.services_admin_withdrawal_set(p_id uuid, p_status text, p_note text default null)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path to 'public'
as $$
declare w record;
begin
  if not public.services_is_admin() then return query select false, 'not_admin'::text; return; end if;
  if p_status not in ('paid', 'rejected') then return query select false, 'bad_status'::text; return; end if;
  select * into w from public.services_withdrawals where id = p_id for update;
  if not found then return query select false, 'not_found'::text; return; end if;
  if w.status <> 'requested' then return query select false, 'already_done'::text; return; end if;
  update public.services_withdrawals
     set status = p_status, note = nullif(btrim(coalesce(p_note, '')), ''), processed_at = now()
   where id = p_id;
  if p_status = 'rejected' then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note)
    values (w.account_id, w.amount_paise, 'refund', 'Withdrawal returned');
  end if;
  return query select true, p_status::text;
end;
$$;
revoke all on function public.services_admin_withdrawal_set(uuid, text, text) from public, anon, authenticated;
grant execute on function public.services_admin_withdrawal_set(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
select 'done' as "103_withdrawals";
