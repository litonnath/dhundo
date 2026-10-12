-- 226_receipt.sql -- the customer's payment receipt for an order, ride, booking or item.
create or replace function public.services_payment_receipt(p_purpose text, p_ref uuid)
returns table (amount_paise int, paid_at timestamptz, txn text, gateway_id text, via text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select p.amount_paise, p.paid_at, p.rp_order_id, p.rp_payment_id,
         case when p.rp_order_id like 'wallet:%' then 'wallet' else 'online' end
    from public.services_payments p
   where p.account_id = public.services_account_id() and p.purpose = p_purpose and p.ref_id = p_ref and p.status = 'paid'
   order by p.paid_at desc limit 1;
$fn$;
revoke all on function public.services_payment_receipt(text, uuid) from public, anon;
grant execute on function public.services_payment_receipt(text, uuid) to authenticated;
notify pgrst, 'reload schema';
select '226 receipt done' as "226";
