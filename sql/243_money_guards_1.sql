-- 243: two money fixes found in review.
-- 1. A withdrawal and a wallet payment used different locks, so sent at the same moment both could
--    spend the same balance. One trigger now takes one lock and refuses a spend or withdrawal that
--    would take the wallet below zero. (Cash settlements may still go negative, by design.)
-- 2. The refund queue refunded the whole payment even when part had been refunded by hand, and an
--    admin could refund by hand after the queue had refunded everything. Both now respect each other.

create or replace function public.services_wallet_debit_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $g$
declare bal bigint;
begin
  if new.amount_paise < 0 and new.kind in ('spend', 'withdrawal') then
    perform pg_advisory_xact_lock(hashtextextended(new.account_id::text, 7));
    select coalesce(sum(e.amount_paise), 0)::bigint into bal
      from public.services_wallet_entries e where e.account_id = new.account_id;
    if bal + new.amount_paise < 0 then
      raise exception 'insufficient_balance' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$g$;

drop trigger if exists services_wallet_debit_guard_trg on public.services_wallet_entries;
create trigger services_wallet_debit_guard_trg
  before insert on public.services_wallet_entries
  for each row execute function public.services_wallet_debit_guard();

notify pgrst, 'reload schema';
select '243 part 1 of 3 done' as "243_1";
