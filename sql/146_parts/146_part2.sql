-- 146 part 2: a shop can send a delivery rider for an order it accepted: a shop
-- delivery order (after the customer accepted the charge), or a delivery order
-- when it does not use riders automatically. The rider fee is what the shop
-- sets. The job is linked to the order, so the customer sees the rider and
-- the order is marked delivered when the rider finishes. Needs 143 and 145.
create or replace function public.services_order_send_rider(p_order uuid, p_fee_rupees int)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  o record;
  v_job uuid;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  select x.* into o from public.services_orders x
   where x.id = p_order and x.status in ('accepted', 'ready') and x.mode in ('delivery', 'shop_delivery')
     and x.job_id is null
     and exists (select 1 from public.services_workers w where w.id = x.worker_id and w.user_id = v_me)
   for update;
  if not found then
    return query select false, 'no_change'::text;
    return;
  end if;
  insert into public.services_jobs (poster_id, poster_work, note, drop_text, fee_paise)
  values (v_me, o.worker_id,
          left('Order: ' || coalesce((select string_agg(l.qty || ' x ' || l.name, ', ')
                                        from public.services_order_lines l where l.order_id = o.id), ''), 300),
          left(coalesce(nullif(btrim(o.address_text), ''), 'See customer'), 200),
          least(greatest(coalesce(p_fee_rupees, 0), 0), 5000) * 100)
  returning id into v_job;
  update public.services_orders set job_id = v_job, updated_at = now() where id = o.id;
  return query select true, 'sent'::text;
end;
$fn$;
revoke all on function public.services_order_send_rider(uuid, int) from public, anon, authenticated;
grant execute on function public.services_order_send_rider(uuid, int) to authenticated;
notify pgrst, 'reload schema';
select 'part 2 of 2 done' as "146_part2";
