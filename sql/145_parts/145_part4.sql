-- 145 part 4: the shop names its delivery charge for a shop delivery order it
-- has accepted (status confirmed). Run after part 3.
create or replace function public.services_order_quote(p_order uuid, p_fee_rupees int)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_n int := 0;
begin
  if public.services_account_id() is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  update public.services_orders x
     set status = 'quoted', delivery_fee_paise = least(greatest(coalesce(p_fee_rupees, 0), 0), 5000) * 100,
         updated_at = now()
   where x.id = p_order and x.mode = 'shop_delivery' and x.status = 'confirmed'
     and exists (select 1 from public.services_workers w
                  where w.id = x.worker_id and w.user_id = public.services_account_id());
  get diagnostics v_n = row_count;
  return query select v_n > 0, case when v_n > 0 then 'ok' else 'no_change' end::text;
end;
$fn$;
revoke all on function public.services_order_quote(uuid, int) from public, anon, authenticated;
grant execute on function public.services_order_quote(uuid, int) to authenticated;
notify pgrst, 'reload schema';
select 'part 4 of 4 done' as "145_part4";
