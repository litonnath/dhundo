-- 249_monthly_3.sql -- admin switches for the rewards. Run after 249_monthly_2.
create table if not exists public.services_rewards_config (
  id int primary key default 1 check (id = 1),
  banner_on boolean not null default true,
  signup_on boolean not null default true,
  monthly_on boolean not null default true,
  signup_paise int not null default 1000 check (signup_paise between 0 and 100000),
  user_paise   int not null default 1000 check (user_paise between 0 and 100000),
  owner_paise  int not null default 5000 check (owner_paise between 0 and 100000)
);
insert into public.services_rewards_config (id) values (1) on conflict do nothing;
alter table public.services_rewards_config enable row level security;
revoke all on public.services_rewards_config from public, anon, authenticated;
-- The sign-up bonus follows the switch and the amount.
create or replace function public.services_signup_bonus_paise()
returns bigint language sql stable security definer set search_path to 'public' as $fn$
  select coalesce((select case when signup_on then signup_paise else 0 end from public.services_rewards_config where id = 1), 0)::bigint
$fn$;
-- What the sign-in screen may show (no login needed).
create or replace function public.services_rewards_public()
returns jsonb language sql stable security definer set search_path to 'public' as $fn$
  select to_jsonb(c) - 'id' from public.services_rewards_config c where id = 1
$fn$;
revoke all on function public.services_rewards_public() from public;
grant execute on function public.services_rewards_public() to anon, authenticated;
-- Admin only: change the switches and amounts (amounts in paise).
create or replace function public.services_admin_rewards_set(p_banner boolean, p_signup_on boolean, p_monthly_on boolean, p_signup int, p_user int, p_owner int)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
begin
  if not public.services_is_admin() then raise exception 'not_admin'; end if;
  update public.services_rewards_config set banner_on = p_banner, signup_on = p_signup_on, monthly_on = p_monthly_on,
    signup_paise = p_signup, user_paise = p_user, owner_paise = p_owner where id = 1;
  return public.services_rewards_public();
end;
$fn$;
revoke all on function public.services_admin_rewards_set(boolean, boolean, boolean, int, int, int) from public, anon;
grant execute on function public.services_admin_rewards_set(boolean, boolean, boolean, int, int, int) to authenticated;
-- The monthly credit follows the switch and the amounts.
create or replace function public.services_claim_monthly_bonus()
returns bigint language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_account uuid := public.services_account_id();
  v_c public.services_rewards_config;
  v_owner boolean; v_amount bigint;
  v_month text := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM');
begin
  if v_account is null then return 0; end if;
  select * into v_c from public.services_rewards_config where id = 1;
  if v_c.id is null or not v_c.monthly_on then return 0; end if;
  if not exists (select 1 from public.services_signups s where s.id = v_account) then return 0; end if;
  select exists (select 1 from public.services_workers w where w.user_id = v_account and w.status = 'approved') into v_owner;
  v_amount := case when v_owner then v_c.owner_paise else v_c.user_paise end;
  if v_amount <= 0 then return 0; end if;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
  values (v_account, v_amount, 'monthly_bonus', 'Monthly bonus', v_month) on conflict do nothing;
  if not found then return 0; end if;
  return v_amount;
end;
$fn$;
select 'done' as "249_monthly_3";
