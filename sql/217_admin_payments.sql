-- ===========================================================================
-- 217_admin_payments.sql -- the admin console's Payments tab: every online
-- payment, who paid, what for, and whether PayU confirmed it. Run after 213.
-- ===========================================================================
create or replace function public.services_admin_payments(p_limit int default 100)
returns table (id uuid, purpose text, amount_paise int, status text, name text, phone text,
               txn text, gateway_id text, created_at timestamptz, paid_at timestamptz, refunded_at timestamptz)
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
    select p.id, p.purpose, p.amount_paise, p.status, s.full_name::text, s.phone::text,
           p.rp_order_id, p.rp_payment_id, p.created_at, p.paid_at, p.refunded_at
      from public.services_payments p join public.services_signups s on s.id = p.account_id
     order by p.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$fn$;
revoke all on function public.services_admin_payments(int) from public, anon;
grant execute on function public.services_admin_payments(int) to authenticated;
notify pgrst, 'reload schema';
select '217 admin payments done' as "217";
