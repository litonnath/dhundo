-- 155_part3.sql -- bank account for payouts, ENCRYPTED. The account number is
-- locked with a key kept in Supabase Vault, so a copy of the table alone is
-- useless. The phone only ever gets the last 4 digits.
--
-- BEFORE running this, create the key once (any long random text, keep it safe):
--   select vault.create_secret('PASTE-A-LONG-RANDOM-TEXT-HERE', 'dhundo_bank_key');
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.services_bank (
  account_id uuid primary key references public.services_signups(id) on delete cascade,
  holder     text not null check (char_length(holder) between 2 and 80),
  acct_enc   bytea not null,
  last4      text not null check (last4 ~ '^[0-9]{4}$'),
  ifsc       text not null check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name  text check (bank_name is null or char_length(bank_name) <= 60),
  updated_at timestamptz not null default now()
);
alter table public.services_bank enable row level security;
revoke all on public.services_bank from public, anon, authenticated;

drop function if exists public.services_bank_get();
create function public.services_bank_get()
returns table (holder text, last4 text, ifsc text, bank_name text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select b.holder, b.last4, b.ifsc, b.bank_name from public.services_bank b
   where b.account_id = public.services_account_id();
$fn$;
revoke all on function public.services_bank_get() from public, anon, authenticated;
grant execute on function public.services_bank_get() to authenticated;

drop function if exists public.services_bank_save(text, text, text, text);
create function public.services_bank_save(p_holder text, p_acct text, p_ifsc text, p_bank text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_acc  uuid := public.services_account_id();
  v_ifsc text := upper(btrim(coalesce(p_ifsc, '')));
  v_no   text := btrim(coalesce(p_acct, ''));
  v_key  text;
begin
  if v_acc is null then return query select false, 'signin'; return; end if;
  perform public.services_rate_guard('bank_save', v_acc::text, 10, 86400);
  if v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then return query select false, 'bad_ifsc'; return; end if;
  if v_no !~ '^[0-9]{6,18}$' then return query select false, 'bad_account'; return; end if;
  if char_length(btrim(coalesce(p_holder, ''))) < 2 then return query select false, 'bad_name'; return; end if;
  select s.decrypted_secret into v_key from vault.decrypted_secrets s where s.name = 'dhundo_bank_key';
  if v_key is null then return query select false, 'no_key'; return; end if;
  insert into public.services_bank (account_id, holder, acct_enc, last4, ifsc, bank_name, updated_at)
  values (v_acc, btrim(p_holder), pgp_sym_encrypt(v_no, v_key), right(v_no, 4), v_ifsc, nullif(btrim(coalesce(p_bank, '')), ''), now())
  on conflict (account_id) do update
     set holder = excluded.holder, acct_enc = excluded.acct_enc, last4 = excluded.last4,
         ifsc = excluded.ifsc, bank_name = excluded.bank_name, updated_at = now();
  return query select true, 'saved';
end;
$fn$;
revoke all on function public.services_bank_save(text, text, text, text) from public, anon, authenticated;
grant execute on function public.services_bank_save(text, text, text, text) to authenticated;
notify pgrst, 'reload schema';
select 'part 3 done' as "155_part3";
