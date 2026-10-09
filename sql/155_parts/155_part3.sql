-- 155_part3.sql -- bank account for payouts. The full number is stored for the
-- owner only and is never sent back: the app only ever sees the last 4 digits.
create table if not exists public.services_bank (
  account_id uuid primary key references public.services_signups(id) on delete cascade,
  holder     text not null check (char_length(holder) between 2 and 80),
  acct_no    text not null check (acct_no ~ '^[0-9]{6,18}$'),
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
  select b.holder, right(b.acct_no, 4), b.ifsc, b.bank_name from public.services_bank b
   where b.account_id = public.services_account_id();
$fn$;
revoke all on function public.services_bank_get() from public, anon, authenticated;
grant execute on function public.services_bank_get() to authenticated;

drop function if exists public.services_bank_save(text, text, text, text);
create function public.services_bank_save(p_holder text, p_acct text, p_ifsc text, p_bank text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare v_acc uuid := public.services_account_id(); v_ifsc text := upper(btrim(coalesce(p_ifsc, '')));
begin
  if v_acc is null then return query select false, 'signin'; return; end if;
  if v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then return query select false, 'bad_ifsc'; return; end if;
  if btrim(coalesce(p_acct, '')) !~ '^[0-9]{6,18}$' then return query select false, 'bad_account'; return; end if;
  if char_length(btrim(coalesce(p_holder, ''))) < 2 then return query select false, 'bad_name'; return; end if;
  insert into public.services_bank (account_id, holder, acct_no, ifsc, bank_name, updated_at)
  values (v_acc, btrim(p_holder), btrim(p_acct), v_ifsc, nullif(btrim(coalesce(p_bank, '')), ''), now())
  on conflict (account_id) do update
     set holder = excluded.holder, acct_no = excluded.acct_no, ifsc = excluded.ifsc,
         bank_name = excluded.bank_name, updated_at = now();
  return query select true, 'saved';
end;
$fn$;
revoke all on function public.services_bank_save(text, text, text, text) from public, anon, authenticated;
grant execute on function public.services_bank_save(text, text, text, text) to authenticated;
notify pgrst, 'reload schema';
select 'part 3 done' as "155_part3";
