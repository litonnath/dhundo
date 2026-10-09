-- 152_part2.sql -- what a customer may see before paying: whether the business
-- takes cash, UPI, and the UPI id to pay to. Run after part 1.
drop function if exists public.services_store_payment(uuid);
create function public.services_store_payment(p_worker uuid)
returns table (accepts_cash boolean, accepts_upi boolean, upi_id text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select p.accepts_cash, p.accepts_upi, case when p.accepts_upi then p.upi_id end
    from public.services_workers w
    join public.services_biz_payment p on p.account_id = w.user_id
   where w.id = p_worker and w.status = 'approved';
$fn$;
revoke all on function public.services_store_payment(uuid) from public;
grant execute on function public.services_store_payment(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
select 'part 2 done' as "152_part2";
