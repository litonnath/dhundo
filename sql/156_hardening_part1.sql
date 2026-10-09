-- 156_hardening_part1.sql -- a new UPI id can only be used 24 hours after it is
-- first typed, so a thief with a stolen session cannot cash out at once and the
-- real owner has time to notice. Also: only signed-in apps may call resume.
create table if not exists public.services_withdraw_upi (
  account_id uuid primary key references public.services_signups(id) on delete cascade,
  upi        text not null,
  first_seen timestamptz not null default now()
);
alter table public.services_withdraw_upi enable row level security;
revoke all on public.services_withdraw_upi from public, anon, authenticated;

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
  v_seen timestamptz;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text, 0::bigint; return;
  end if;
  perform public.services_rate_guard('withdraw', v_me::text, 5, 86400);
  if not public.services_account_phone_ok(v_me) then
    return query select false, 'phone_not_verified'::text, 0::bigint; return;
  end if;
  if v_upi !~ '^[a-z0-9._-]{2,64}@[a-z][a-z0-9.-]{1,30}$' then
    return query select false, 'bad_upi'::text, 0::bigint; return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_me::text, 0));
  -- The 24 hour hold on a UPI id the account has not used before.
  select u.first_seen into v_seen from public.services_withdraw_upi u where u.account_id = v_me and u.upi = v_upi;
  if v_seen is null then
    insert into public.services_withdraw_upi (account_id, upi, first_seen) values (v_me, v_upi, now())
    on conflict (account_id) do update set upi = excluded.upi, first_seen = now();
    return query select false, 'upi_hold'::text, 0::bigint; return;
  end if;
  if v_seen > now() - interval '24 hours' then
    return query select false, 'upi_hold'::text, 0::bigint; return;
  end if;
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
$fn$;
revoke all on function public.services_withdraw_request(text) from public, anon, authenticated;
grant execute on function public.services_withdraw_request(text) to authenticated;

revoke all on function public.services_resume_due() from public, anon;
grant execute on function public.services_resume_due() to authenticated;
notify pgrst, 'reload schema';
select 'hardening part 1 done' as "156_part1";
