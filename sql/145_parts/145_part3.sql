-- 145 part 3: moving an order along. Delivery orders post a rider job when accepted.
-- For a shop_delivery order the shop first accepts (status confirmed), then names a
-- charge by distance (services_order_quote), then the customer accepts it (accept_quote). Replaces 143 part 4.
alter table public.services_orders add column if not exists delivery_fee_paise int not null default 0;

create or replace function public.services_order_update(p_order uuid, p_action text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_n int := 0;
  o record;
  v_job uuid;
  v_fee int;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  if p_action = 'cancel' then
    update public.services_orders set status = 'cancelled', updated_at = now()
     where id = p_order and customer_id = v_me and status in ('placed', 'confirmed', 'quoted');
    get diagnostics v_n = row_count;
  elsif p_action = 'accept_quote' then
    update public.services_orders set status = 'accepted', updated_at = now()
     where id = p_order and customer_id = v_me and status = 'quoted' and mode = 'shop_delivery';
    get diagnostics v_n = row_count;
  elsif p_action in ('accept', 'reject', 'ready', 'delivered') then
    update public.services_orders x
       set status = case p_action when 'accept' then (case when x.mode = 'shop_delivery' then 'confirmed' else 'accepted' end)
                                  when 'reject' then 'rejected'
                                  when 'ready' then 'ready' else 'delivered' end,
           updated_at = now()
     where x.id = p_order
       and exists (select 1 from public.services_workers w where w.id = x.worker_id and w.user_id = v_me)
       and ((p_action = 'accept' and x.status = 'placed')
         or (p_action = 'reject' and x.status in ('placed', 'confirmed', 'quoted'))
         or (p_action = 'ready' and x.status = 'accepted')
         or (p_action = 'delivered' and x.status in ('accepted', 'ready')))
    returning x.* into o;
    get diagnostics v_n = row_count;
    if v_n > 0 and p_action = 'accept' and o.mode = 'delivery'
       and exists (select 1 from public.services_workers w where w.id = o.worker_id and w.auto_rider) then
      v_fee := case when o.delivery_fee_paise > 0 then o.delivery_fee_paise
                    else public.services_delivery_fee(o.worker_id, o.lat, o.lng) end;
      insert into public.services_jobs (poster_id, poster_work, note, drop_text, fee_paise)
      select v_me, o.worker_id,
             left('Order: ' || coalesce((select string_agg(l.qty || ' x ' || l.name, ', ')
                                           from public.services_order_lines l where l.order_id = o.id), ''), 300),
             left(coalesce(nullif(btrim(o.address_text), ''), 'See customer'), 200),
             v_fee
      returning id into v_job;
      update public.services_orders set job_id = v_job where id = o.id;
    end if;
  end if;
  return query select v_n > 0, case when v_n > 0 then 'ok' else 'no_change' end::text;
end;
$fn$;
revoke all on function public.services_order_update(uuid, text) from public, anon, authenticated;
grant execute on function public.services_order_update(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select 'part 3 of 3 done' as "145_part3";

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
