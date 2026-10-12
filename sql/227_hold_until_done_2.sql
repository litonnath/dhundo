-- 227_hold_until_done_2.sql -- part 2 of 3: a cancelled order takes an earning back only if one was credited.
create or replace function public.services_refund_payment(p_purpose text, p_ref uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  p record;
  v_acct uuid;
  v_amt bigint;
begin
  select * into p from public.services_payments
   where purpose = p_purpose and ref_id = p_ref and status = 'paid' and refunded_at is null
   order by paid_at desc limit 1 for update;
  if not found then return; end if;
  update public.services_payments set refunded_at = now() where id = p.id;
  insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
  values (p.account_id, p.amount_paise - coalesce((select sum(e.amount_paise) from public.services_wallet_entries e where e.ref = 'feediff:' || p_ref::text), 0), 'refund', 'Refund for a cancelled ' || p_purpose, 'refund:' || p.id::text) on conflict do nothing;
  if p_purpose = 'order' then
    select w.user_id, o.total_paise into v_acct, v_amt
      from public.services_orders o join public.services_workers w on w.id = o.worker_id where o.id = p_ref;
  elsif p_purpose = 'item' then
    select i.seller_id, (i.offer_rupees * 100)::bigint into v_acct, v_amt from public.services_item_orders i where i.id = p_ref;
  end if;
  if v_acct is not null and coalesce(v_amt, 0) > 0
     and exists (select 1 from public.services_wallet_entries x where x.kind = 'earning' and x.ref = p_purpose || ':' || p_ref::text) then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (v_acct, -v_amt, 'adjustment', 'Order cancelled: earning taken back', 'reverse:' || p.id::text) on conflict do nothing;
  end if;
end;
$fn$;
revoke all on function public.services_refund_payment(text, uuid) from public, anon, authenticated;
select '227 hold part 2 done' as "227_2";
