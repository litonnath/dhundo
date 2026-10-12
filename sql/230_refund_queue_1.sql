-- 230_refund_queue_1.sql -- refunds are approved by the admin, never sent straight away. Part 1 of 3.
-- A cancelled paid order, ride, booking or item raises a refund REQUEST; the money stays held until
-- the admin approves it. Needs 216, 225 and 227. Run 230_refund_queue_2 and _3 next.
create table if not exists public.services_refund_requests (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.services_payments(id) on delete cascade,
  account_id uuid not null,
  purpose text not null,
  ref_id uuid not null,
  amount_paise int not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
alter table public.services_refund_requests enable row level security;
revoke all on public.services_refund_requests from public, anon, authenticated;

create or replace function public.services_refund_request(p_purpose text, p_ref uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare p record;
begin
  select * into p from public.services_payments
   where purpose = p_purpose and ref_id = p_ref and status = 'paid' and refunded_at is null
   order by paid_at desc limit 1;
  if not found then return; end if;
  insert into public.services_refund_requests (payment_id, account_id, purpose, ref_id, amount_paise, reason)
  values (p.id, p.account_id, p_purpose, p_ref, p.amount_paise, p_reason) on conflict do nothing;
end;
$fn$;
revoke all on function public.services_refund_request(text, uuid, text) from public, anon, authenticated;

-- What approving does: the money goes back to the payer's wallet (less any delivery fee already
-- refunded), and anything credited to a partner for it is taken back.
create or replace function public.services_refund_apply(p_request uuid)
returns boolean language plpgsql security definer set search_path to 'public' as $fn$
declare r record; p record; e record;
begin
  select * into r from public.services_refund_requests where id = p_request for update;
  if not found or r.status <> 'pending' then return false; end if;
  select * into p from public.services_payments where id = r.payment_id for update;
  if p.refunded_at is not null then return false; end if;
  update public.services_payments set refunded_at = now() where id = p.id;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
  values (p.account_id, p.amount_paise - coalesce((select sum(x.amount_paise) from public.services_wallet_entries x
            where x.ref = 'feediff:' || p.ref_id::text), 0), 'refund', 'Refund: ' || coalesce(r.reason, p.purpose), 'refund:' || p.id::text)
  on conflict do nothing;
  for e in select x.account_id, x.amount_paise from public.services_wallet_entries x
            where x.kind = 'earning' and x.ref in (p.purpose || ':' || p.ref_id::text, 'ridefee:' || p.ref_id::text) loop
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (e.account_id, -e.amount_paise, 'adjustment', 'Refunded: earning taken back', 'reverse:' || p.id::text || ':' || e.account_id::text)
    on conflict do nothing;
  end loop;
  perform public.services_notify(p.account_id, 'refund_done', (p.amount_paise / 100)::text);
  return true;
end;
$fn$;
revoke all on function public.services_refund_apply(uuid) from public, anon, authenticated;
select '230 refund queue part 1 done' as "230_1";
