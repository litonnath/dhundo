-- ===========================================================================
-- 221_admin_refunds_1.sql -- the admin can refund a person who raised an issue:
-- into their Dhundo wallet (instant) or back to their UPI id (you pay it, then
-- mark it paid). Every refund is recorded with who gave it and why. Part 1 of
-- 2; run 221_admin_refunds_2.sql next. Needs 213, 215 and the admin console.
-- ===========================================================================
alter table public.services_payments add column if not exists refunded_paise int not null default 0;
create table if not exists public.services_admin_refunds (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null,
  account_id   uuid not null references public.services_signups(id) on delete cascade,
  payment_id   uuid references public.services_payments(id) on delete set null,
  ticket_id    uuid,
  amount_paise int not null check (amount_paise between 100 and 5000000),
  dest         text not null check (dest in ('wallet', 'upi')),
  upi_id       text,
  reason       text not null check (char_length(reason) between 3 and 300),
  status       text not null check (status in ('done', 'to_pay', 'paid')),
  created_at   timestamptz not null default now(),
  paid_at      timestamptz
);
alter table public.services_admin_refunds enable row level security;
revoke all on public.services_admin_refunds from public, anon, authenticated;
create unique index if not exists services_wallet_one_adminrefund on public.services_wallet_entries (ref) where kind = 'refund' and ref like 'adminrefund:%';

create or replace function public.services_admin_refund(p_account uuid, p_rupees int, p_dest text, p_reason text,
                                                        p_payment uuid default null, p_ticket uuid default null, p_upi text default null)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_id uuid := gen_random_uuid();
  v_paise int := coalesce(p_rupees, 0) * 100;
  v_upi text := lower(btrim(coalesce(p_upi, '')));
  pay record;
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  if v_paise < 100 or v_paise > 5000000 then
    return query select false, 'bad_amount'::text; return;
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 or p_dest not in ('wallet', 'upi') then
    return query select false, 'bad_input'::text; return;
  end if;
  if p_dest = 'upi' and v_upi !~ '^[a-z0-9._-]{2,64}@[a-z][a-z0-9.-]{1,30}$' then
    return query select false, 'bad_upi'::text; return;
  end if;
  if not exists (select 1 from public.services_signups s where s.id = p_account) then
    return query select false, 'no_account'::text; return;
  end if;
  if p_payment is not null then
    select * into pay from public.services_payments where id = p_payment and account_id = p_account and status = 'paid' for update;
    if not found or pay.refunded_paise + v_paise > pay.amount_paise then
      return query select false, 'over_payment'::text; return;
    end if;
    update public.services_payments set refunded_paise = refunded_paise + v_paise where id = p_payment;
  end if;
  insert into public.services_admin_refunds (id, admin_id, account_id, payment_id, ticket_id, amount_paise, dest, upi_id, reason, status)
  values (v_id, public.services_account_id(), p_account, p_payment, p_ticket, v_paise, p_dest, case when p_dest = 'upi' then v_upi end,
          left(btrim(p_reason), 300), case when p_dest = 'wallet' then 'done' else 'to_pay' end);
  if p_dest = 'wallet' then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (p_account, v_paise, 'refund', 'Refund from Dhundo: ' || left(btrim(p_reason), 80), 'adminrefund:' || v_id::text);
  end if;
  if p_ticket is not null then
    insert into public.services_support_messages (ticket_id, sender, body)
    values (p_ticket, 'agent', 'We have refunded ' || chr(8377) || (v_paise / 100)::text
            || case when p_dest = 'wallet' then ' to your Dhundo wallet.' else ' to your UPI id ' || v_upi || '. It will reach you shortly.' end);
    update public.services_support_tickets set updated_at = now(), unread_user = true where id = p_ticket;
  end if;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_admin_refund(uuid, int, text, text, uuid, uuid, text) from public, anon;
grant execute on function public.services_admin_refund(uuid, int, text, text, uuid, uuid, text) to authenticated;
notify pgrst, 'reload schema';
select '221 admin refunds part 1 done' as "221_1";
