-- 246 part 2 of 2: accepting needs an agreed price; the customer answers the price; a small price list for the screen.
-- Run after part 1.

create or replace function public.services_booking_answer(p_id uuid, p_accept boolean)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  if p_accept and not exists (select 1 from public.services_bookings b
                               join public.services_workers w on w.id = b.worker_id and w.user_id = v_me
                              where b.id = p_id and b.price_ok and coalesce(b.price_paise, 0) >= 100) then
    return query select false, 'price_first'::text;   -- set a price and wait for the customer to agree
    return;
  end if;
  update public.services_bookings b
     set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now()
   where b.id = p_id and b.status = 'requested'
     and exists (select 1 from public.services_workers w where w.id = b.worker_id and w.user_id = v_me);
  if not found then
    return query select false, 'not_allowed'::text;
    return;
  end if;
  return query select true, case when p_accept then 'accepted' else 'declined' end::text;
end;
$fn$;
revoke all on function public.services_booking_answer(uuid, boolean) from public, anon, authenticated;
grant execute on function public.services_booking_answer(uuid, boolean) to authenticated;

create or replace function public.services_booking_price_answer(p_id uuid, p_ok boolean)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_w uuid;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text; return;
  end if;
  select w.user_id into v_w from public.services_bookings b join public.services_workers w on w.id = b.worker_id
   where b.id = p_id and b.customer_id = v_me and b.status = 'requested' and b.price_paise is not null;
  if v_w is null then
    return query select false, 'not_allowed'::text; return;
  end if;
  if p_ok then
    update public.services_bookings set price_ok = true where id = p_id;
    perform public.services_notify(v_w, 'booking_price_ok', null);
  else
    update public.services_bookings set price_ok = false, price_paise = null where id = p_id;
    perform public.services_notify(v_w, 'booking_price_no', null);
  end if;
  return query select true, 'ok'::text;
end;
$fn$;
revoke all on function public.services_booking_price_answer(uuid, boolean) from public, anon;
grant execute on function public.services_booking_price_answer(uuid, boolean) to authenticated;

create or replace function public.services_booking_quotes(p_ids uuid[])
returns table (id uuid, price_paise int, price_ok boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select b.id, b.price_paise, b.price_ok
    from public.services_bookings b
    left join public.services_workers w on w.id = b.worker_id
   where b.id = any (coalesce(p_ids, '{}'::uuid[]))
     and (b.customer_id = public.services_account_id() or w.user_id = public.services_account_id());
$fn$;
revoke all on function public.services_booking_quotes(uuid[]) from public, anon;
grant execute on function public.services_booking_quotes(uuid[]) to authenticated;
notify pgrst, 'reload schema';
select '246 part 2 of 2 done' as "246_2";
