-- ===========================================================================
-- 116_part8.sql -- move an order along. The owner accepts, rejects, marks it
-- ready and delivered; the customer can cancel while it is still new.
-- ===========================================================================
create or replace function public.services_order_update(p_order uuid, p_action text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_n int := 0;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  if p_action = 'cancel' then
    update public.services_orders set status = 'cancelled', updated_at = now()
     where id = p_order and customer_id = v_me and status = 'placed';
    get diagnostics v_n = row_count;
  elsif p_action in ('accept', 'reject', 'ready', 'delivered') then
    update public.services_orders o
       set status = case p_action when 'accept' then 'accepted' when 'reject' then 'rejected'
                                  when 'ready' then 'ready' else 'delivered' end,
           updated_at = now()
     where o.id = p_order
       and exists (select 1 from public.services_workers w
                    where w.id = o.worker_id and w.user_id = v_me)
       and ((p_action in ('accept', 'reject') and o.status = 'placed')
         or (p_action = 'ready' and o.status = 'accepted')
         or (p_action = 'delivered' and o.status in ('accepted', 'ready')));
    get diagnostics v_n = row_count;
  end if;
  return query select v_n > 0, case when v_n > 0 then 'ok' else 'no_change' end::text;
end;
$fn$;
revoke all on function public.services_order_update(uuid, text) from public, anon, authenticated;
grant execute on function public.services_order_update(uuid, text) to authenticated;

notify pgrst, 'reload schema';
select 'part 8 of 8 done' as "116_part8";
