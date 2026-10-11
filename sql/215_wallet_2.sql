-- 215_wallet_2.sql -- wallet part 2 of 2: settle a payment (mark paid, credit
-- the partner), top-up credit, and pay from the wallet. Run after part 1.
create or replace function public.services_apply_payment(p_purpose text, p_ref uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_acct uuid;
  v_amt bigint := 0;
  v_note text;
begin
  if p_purpose = 'order' then
    update public.services_orders set paid = true, paid_at = now(), pay_method = 'upi', updated_at = updated_at where id = p_ref;
    select w.user_id, o.total_paise into v_acct, v_amt
      from public.services_orders o join public.services_workers w on w.id = o.worker_id where o.id = p_ref;
    v_note := 'Order payment';
  elsif p_purpose = 'ride' then
    update public.services_rides set paid_online = true where id = p_ref;
    select w.user_id, r.fare_paise into v_acct, v_amt
      from public.services_rides r join public.services_workers w on w.id = r.driver_work where r.id = p_ref;
    v_note := 'Ride fare';
  elsif p_purpose = 'item' then
    update public.services_item_orders set paid_online = true where id = p_ref;
    select i.seller_id, (i.offer_rupees * 100)::bigint into v_acct, v_amt from public.services_item_orders i where i.id = p_ref;
    v_note := 'Item sale';
  end if;
  if v_acct is not null and coalesce(v_amt, 0) > 0 then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (v_acct, v_amt, 'earning', v_note, p_purpose || ':' || p_ref::text)
    on conflict do nothing;
  end if;
end;
$fn$;
revoke all on function public.services_apply_payment(text, uuid) from public, anon, authenticated;

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
  if p.purpose = 'topup' then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (p.account_id, p.amount_paise, 'topup', 'Money added', 'topup:' || p.id::text) on conflict do nothing;
  else
    perform public.services_apply_payment(p.purpose, p.ref_id);
  end if;
  return 'paid';
end;
$fn$;
revoke all on function public.services_payment_mark_paid(text, text, int) from public, anon, authenticated;
grant execute on function public.services_payment_mark_paid(text, text, int) to service_role;

create or replace function public.services_wallet_pay(p_purpose text, p_ref uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  a record;
  v_bal bigint;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text; return;
  end if;
  if p_purpose not in ('order', 'ride', 'item') then
    return query select false, 'bad_purpose'::text; return;
  end if;
  perform public.services_rate_guard('wallet_pay', v_me::text, 60, 3600);
  perform pg_advisory_xact_lock(hashtextextended(v_me::text, 1));
  select * into a from public.services_payment_amount(v_me, p_purpose, p_ref);
  if not a.ok then
    return query select false, a.reason; return;
  end if;
  select coalesce(sum(e.amount_paise), 0)::bigint into v_bal from public.services_wallet_entries e where e.account_id = v_me;
  if v_bal < a.amount_paise then
    return query select false, 'insufficient'::text; return;
  end if;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
  values (v_me, -a.amount_paise, 'spend', case p_purpose when 'order' then 'Paid for an order' when 'ride' then 'Paid for a ride' else 'Paid for an item' end,
          'spend:' || p_purpose || ':' || p_ref::text);
  insert into public.services_payments (account_id, purpose, ref_id, amount_paise, rp_order_id, status, paid_at)
  values (v_me, p_purpose, p_ref, a.amount_paise, 'wallet:' || gen_random_uuid()::text, 'paid', now());
  perform public.services_apply_payment(p_purpose, p_ref);
  return query select true, 'paid'::text;
end;
$fn$;
revoke all on function public.services_wallet_pay(text, uuid) from public, anon;
grant execute on function public.services_wallet_pay(text, uuid) to authenticated;
notify pgrst, 'reload schema';
select '215 wallet part 2 done' as "215_2";
