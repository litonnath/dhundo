-- ===========================================================================
-- 213_payments_2.sql -- online payment, part 2 of 2: recording a gateway
-- order and marking it paid. Only the two Edge Functions (service role) can
-- call these; nobody on a phone can mark a payment paid. Run after part 1.
-- ===========================================================================
alter table public.services_item_orders add column if not exists paid_online boolean not null default false;
alter table public.services_rides add column if not exists paid_online boolean not null default false;

create or replace function public.services_payment_record(p_account uuid, p_purpose text, p_ref uuid, p_amount int, p_rp_order text)
returns void
language sql
security definer
set search_path to 'public'
as $fn$
  insert into public.services_payments (account_id, purpose, ref_id, amount_paise, rp_order_id)
  values (p_account, p_purpose, p_ref, p_amount, p_rp_order)
  on conflict (rp_order_id) do nothing;
$fn$;
revoke all on function public.services_payment_record(uuid, text, uuid, int, text) from public, anon, authenticated;
grant execute on function public.services_payment_record(uuid, text, uuid, int, text) to service_role;

create or replace function public.services_payment_mark_paid(p_rp_order text, p_rp_payment text, p_amount int)
returns text
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  p record;
begin
  select * into p from public.services_payments where rp_order_id = p_rp_order for update;
  if not found then return 'unknown_order'; end if;
  if p.status = 'paid' then return 'already'; end if;
  if p_amount is not null and p_amount <> p.amount_paise then return 'amount_mismatch'; end if;
  update public.services_payments set status = 'paid', rp_payment_id = p_rp_payment, paid_at = now() where id = p.id;
  if p.purpose = 'order' then
    update public.services_orders set paid = true, paid_at = now(), pay_method = 'upi', updated_at = updated_at where id = p.ref_id;
  elsif p.purpose = 'ride' then
    update public.services_rides set paid_online = true where id = p.ref_id;
  elsif p.purpose = 'item' then
    update public.services_item_orders set paid_online = true where id = p.ref_id;
  end if;
  return 'paid';
end;
$fn$;
revoke all on function public.services_payment_mark_paid(text, text, int) from public, anon, authenticated;
grant execute on function public.services_payment_mark_paid(text, text, int) to service_role;
notify pgrst, 'reload schema';
select '213 payments part 2 done' as "213_2";
