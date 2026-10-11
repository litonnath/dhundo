-- 222_withdraw_2.sql -- part 2 of 2: the admin sees bank or UPI details on each
-- withdrawal, and can reveal the full bank account number to pay it (each look
-- is logged). Run after part 1. Needs the Vault key from 155_part3.
create table if not exists public.services_admin_bank_views (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  withdrawal_id uuid,
  at timestamptz not null default now()
);
alter table public.services_admin_bank_views enable row level security;
revoke all on public.services_admin_bank_views from public, anon, authenticated;

drop function if exists public.services_admin_withdrawals(text);
create function public.services_admin_withdrawals(p_status text default 'requested')
returns table (id uuid, amount_paise bigint, upi_id text, status text, note text, created_at timestamptz,
               full_name text, phone text, listings int, dest text, bank_holder text, bank_last4 text, bank_ifsc text)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  return query
    select w.id, w.amount_paise, w.upi_id, w.status, w.note, w.created_at, s.full_name::text, s.phone::text,
           (select count(*)::int from public.services_workers x where x.user_id = w.account_id and x.status = 'approved'),
           w.dest, w.bank_holder, w.bank_last4, w.bank_ifsc
      from public.services_withdrawals w join public.services_signups s on s.id = w.account_id
     where p_status is null or w.status = p_status order by w.created_at desc limit 100;
end;
$fn$;
revoke all on function public.services_admin_withdrawals(text) from public, anon;
grant execute on function public.services_admin_withdrawals(text) to authenticated;

create or replace function public.services_admin_bank_reveal(p_withdrawal uuid)
returns table (holder text, account_number text, ifsc text)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_key text;
  v_acct uuid;
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  select w.account_id into v_acct from public.services_withdrawals w where w.id = p_withdrawal and w.dest = 'bank';
  if v_acct is null then return; end if;
  select s.decrypted_secret into v_key from vault.decrypted_secrets s where s.name = 'dhundo_bank_key';
  if v_key is null then return; end if;
  insert into public.services_admin_bank_views (admin_id, withdrawal_id) values (public.services_account_id(), p_withdrawal);
  return query select b.holder, pgp_sym_decrypt(b.acct_enc, v_key), b.ifsc from public.services_bank b where b.account_id = v_acct;
end;
$fn$;
revoke all on function public.services_admin_bank_reveal(uuid) from public, anon;
grant execute on function public.services_admin_bank_reveal(uuid) to authenticated;
notify pgrst, 'reload schema';
select '222 withdraw part 2 done' as "222_2";
