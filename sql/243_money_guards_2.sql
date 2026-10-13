-- 243 part 2 of 3: the refund queue respects refunds already made by hand. Run after part 1.

create or replace function public.services_refund_apply(p_request uuid)
returns boolean language plpgsql security definer set search_path to 'public' as $fn$
declare r record; p record; e record; v_amt bigint;
begin
  select * into r from public.services_refund_requests where id = p_request for update;
  if not found or r.status <> 'pending' then return false; end if;
  select * into p from public.services_payments where id = r.payment_id for update;
  if p.refunded_at is not null then return false; end if;
  update public.services_payments set refunded_at = now(), refunded_paise = p.amount_paise where id = p.id;
  -- what is still owed: the payment, less any part already refunded by hand and any delivery-fee difference
  v_amt := p.amount_paise - coalesce(p.refunded_paise, 0)
           - coalesce((select sum(x.amount_paise) from public.services_wallet_entries x where x.ref = 'feediff:' || p.ref_id::text), 0);
  if v_amt > 0 then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (p.account_id, v_amt, 'refund', 'Refund: ' || coalesce(r.reason, p.purpose), 'refund:' || p.id::text)
    on conflict do nothing;
  end if;
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

notify pgrst, 'reload schema';
select '243 part 2 of 3 done' as "243_2";
