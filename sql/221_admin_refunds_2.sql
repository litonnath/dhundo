-- 221_admin_refunds_2.sql -- part 2 of 2: the refund list, marking a UPI refund
-- paid, and the account id on the admin Payments and Support lists so a refund
-- can be started from them. Run after part 1.
create or replace function public.services_admin_refunds_list(p_status text default 'to_pay')
returns table (id uuid, name text, phone text, amount_paise int, dest text, upi_id text, reason text, status text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  return query select r.id, s.full_name::text, s.phone::text, r.amount_paise, r.dest, r.upi_id, r.reason, r.status, r.created_at
    from public.services_admin_refunds r join public.services_signups s on s.id = r.account_id
   where p_status = 'all' or r.status = p_status order by r.created_at desc limit 200;
end;
$fn$;
revoke all on function public.services_admin_refunds_list(text) from public, anon;
grant execute on function public.services_admin_refunds_list(text) to authenticated;

create or replace function public.services_admin_refund_paid(p_id uuid)
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  update public.services_admin_refunds set status = 'paid', paid_at = now() where id = p_id and status = 'to_pay';
  return query select found;
end;
$fn$;
revoke all on function public.services_admin_refund_paid(uuid) from public, anon;
grant execute on function public.services_admin_refund_paid(uuid) to authenticated;

drop function if exists public.services_admin_payments(int);
create function public.services_admin_payments(p_limit int default 100)
returns table (id uuid, purpose text, amount_paise int, status text, name text, phone text,
               txn text, gateway_id text, created_at timestamptz, paid_at timestamptz, refunded_at timestamptz,
               account_id uuid, refunded_paise int)
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
           p.rp_order_id, p.rp_payment_id, p.created_at, p.paid_at, p.refunded_at, p.account_id, p.refunded_paise
      from public.services_payments p join public.services_signups s on s.id = p.account_id
     order by p.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$fn$;
revoke all on function public.services_admin_payments(int) from public, anon;
grant execute on function public.services_admin_payments(int) to authenticated;

drop function if exists public.services_admin_support_list(text);
create function public.services_admin_support_list(p_status text default 'open')
returns table (id uuid, topic text, ref text, status text, unread boolean, name text, phone text,
               created_at timestamptz, updated_at timestamptz, last_body text, account_id uuid)
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
    select t.id, t.topic, t.ref, t.status, t.unread_agent, s.full_name::text, s.phone::text,
           t.created_at, t.updated_at,
           (select m.body from public.services_support_messages m where m.ticket_id = t.id order by m.created_at desc limit 1),
           t.account_id
      from public.services_support_tickets t join public.services_signups s on s.id = t.account_id
     where p_status = 'all' or t.status = p_status
     order by t.unread_agent desc, t.updated_at desc limit 200;
end;
$fn$;
revoke all on function public.services_admin_support_list(text) from public, anon;
grant execute on function public.services_admin_support_list(text) to authenticated;
notify pgrst, 'reload schema';
select '221 admin refunds part 2 done' as "221_2";
