-- 223_pay_guard_2.sql -- part 2 of 2: cash/QR confirmation for bookings and items
-- is refused once paid online, and the admin payments list shows the issue.
create or replace function public.services_pay_mark_received(p_purpose text, p_id uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text; return;
  end if;
  if p_purpose = 'booking' then
    update public.services_bookings b set paid_cash = true from public.services_workers w
     where b.id = p_id and w.id = b.worker_id and w.user_id = v_me and b.status in ('accepted', 'completed') and not b.paid_online;
  elsif p_purpose = 'item' then
    update public.services_item_orders set paid_cash = true
     where id = p_id and seller_id = v_me and status in ('accepted', 'completed') and not paid_online;
  else
    return query select false, 'bad_purpose'::text; return;
  end if;
  if not found then
    return query select false, 'not_allowed'::text; return;
  end if;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_pay_mark_received(text, uuid) from public, anon;
grant execute on function public.services_pay_mark_received(text, uuid) to authenticated;

drop function if exists public.services_admin_payments(int);
create function public.services_admin_payments(p_limit int default 100)
returns table (id uuid, purpose text, amount_paise int, status text, name text, phone text,
               txn text, gateway_id text, created_at timestamptz, paid_at timestamptz, refunded_at timestamptz,
               account_id uuid, refunded_paise int, issue text)
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
           p.rp_order_id, p.rp_payment_id, p.created_at, p.paid_at, p.refunded_at, p.account_id, p.refunded_paise, p.issue
      from public.services_payments p join public.services_signups s on s.id = p.account_id
     order by (p.issue is not null and p.refunded_at is null) desc, p.created_at desc
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$fn$;
revoke all on function public.services_admin_payments(int) from public, anon;
grant execute on function public.services_admin_payments(int) to authenticated;
notify pgrst, 'reload schema';
select '223 pay guard part 2 done' as "223_2";
