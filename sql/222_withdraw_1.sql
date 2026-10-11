-- ===========================================================================
-- 222_withdraw_1.sql -- withdraw what you have earned to a UPI id OR to a bank
-- account, any amount from the minimum (Rs 100) up to the whole balance. New
-- UPI ids and newly changed bank details wait 24 hours before they can be used.
-- Part 1 of 2; run 222_withdraw_2.sql next. Needs 103, 155_part3 and 156.
-- ===========================================================================
alter table public.services_withdrawals alter column upi_id drop not null;
alter table public.services_withdrawals add column if not exists dest text not null default 'upi' check (dest in ('upi', 'bank'));
alter table public.services_withdrawals add column if not exists bank_holder text;
alter table public.services_withdrawals add column if not exists bank_last4 text;
alter table public.services_withdrawals add column if not exists bank_ifsc text;
create or replace function public.services_withdraw_min_paise() returns bigint language sql immutable as $$ select 10000::bigint $$;

create or replace function public.services_withdraw_request2(p_dest text, p_upi text, p_rupees int default null)
returns table (ok boolean, reason text, amount_paise bigint)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_upi text := lower(btrim(coalesce(p_upi, '')));
  v_bal bigint;
  v_amt bigint;
  v_seen timestamptz;
  bk record;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text, 0::bigint; return;
  end if;
  perform public.services_rate_guard('withdraw', v_me::text, 8, 86400);
  if not public.services_account_phone_ok(v_me) then
    return query select false, 'phone_not_verified'::text, 0::bigint; return;
  end if;
  if p_dest not in ('upi', 'bank') then
    return query select false, 'bad_dest'::text, 0::bigint; return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_me::text, 0));
  if p_dest = 'upi' then
    if v_upi !~ '^[a-z0-9._-]{2,64}@[a-z][a-z0-9.-]{1,30}$' then
      return query select false, 'bad_upi'::text, 0::bigint; return;
    end if;
    select u.first_seen into v_seen from public.services_withdraw_upi u where u.account_id = v_me and u.upi = v_upi;
    if v_seen is null then
      insert into public.services_withdraw_upi (account_id, upi, first_seen) values (v_me, v_upi, now())
      on conflict (account_id) do update set upi = excluded.upi, first_seen = now();
      return query select false, 'upi_hold'::text, 0::bigint; return;
    end if;
    if v_seen > now() - interval '24 hours' then
      return query select false, 'upi_hold'::text, 0::bigint; return;
    end if;
  else
    select b.holder, b.last4, b.ifsc, b.updated_at into bk from public.services_bank b where b.account_id = v_me;
    if not found then
      return query select false, 'no_bank'::text, 0::bigint; return;
    end if;
    if bk.updated_at > now() - interval '24 hours' then
      return query select false, 'bank_hold'::text, 0::bigint; return;
    end if;
  end if;
  if exists (select 1 from public.services_withdrawals w where w.account_id = v_me and w.status = 'requested') then
    return query select false, 'already_open'::text, 0::bigint; return;
  end if;
  select coalesce(sum(e.amount_paise), 0)::bigint into v_bal from public.services_wallet_entries e where e.account_id = v_me;
  v_amt := case when p_rupees is null then v_bal else p_rupees::bigint * 100 end;
  if v_amt < public.services_withdraw_min_paise() then
    return query select false, 'below_minimum'::text, v_bal; return;
  end if;
  if v_amt > v_bal then
    return query select false, 'insufficient'::text, v_bal; return;
  end if;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note)
  values (v_me, -v_amt, 'withdrawal', case when p_dest = 'upi' then 'Withdrawal to ' || v_upi else 'Withdrawal to bank account ending ' || bk.last4 end);
  insert into public.services_withdrawals (account_id, amount_paise, upi_id, dest, bank_holder, bank_last4, bank_ifsc)
  values (v_me, v_amt, case when p_dest = 'upi' then v_upi end, p_dest,
          case when p_dest = 'bank' then bk.holder end, case when p_dest = 'bank' then bk.last4 end, case when p_dest = 'bank' then bk.ifsc end);
  return query select true, 'requested'::text, v_amt;
end;
$fn$;
revoke all on function public.services_withdraw_request2(text, text, int) from public, anon;
grant execute on function public.services_withdraw_request2(text, text, int) to authenticated;
notify pgrst, 'reload schema';
select '222 withdraw part 1 done' as "222_1";
