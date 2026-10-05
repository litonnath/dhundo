-- ===========================================================================
-- 120_part2.sql -- the owner settings and the public store info carry the
-- offer. The functions change shape, so the old ones are dropped first.
-- ===========================================================================
drop function if exists public.services_my_store();
create function public.services_my_store()
returns table (accepting boolean, open_time time, close_time time, delivery_mins int,
               auto_rider boolean, promo_text text, promo_photo text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select w.accepting_orders, w.open_time, w.close_time, w.delivery_mins, w.auto_rider,
         w.promo_text, w.promo_photo
    from public.services_workers w
   where w.user_id = public.services_account_id() and w.status in ('approved', 'pending')
   limit 1;
$fn$;
revoke all on function public.services_my_store() from public, anon, authenticated;
grant execute on function public.services_my_store() to authenticated;

drop function if exists public.services_set_store(time, time, int, boolean);
create function public.services_set_store(
  p_open time, p_close time, p_mins int, p_auto_rider boolean,
  p_promo text default null, p_promo_photo text default null)
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_n int;
begin
  update public.services_workers
     set open_time = p_open, close_time = p_close,
         delivery_mins = case when p_mins between 5 and 720 then p_mins end,
         auto_rider = coalesce(p_auto_rider, true),
         promo_text = nullif(left(btrim(coalesce(p_promo, '')), 140), ''),
         promo_photo = case when p_promo_photo like 'https://%' and length(p_promo_photo) <= 500 then p_promo_photo end
   where user_id = public.services_account_id() and status in ('approved', 'pending');
  get diagnostics v_n = row_count;
  return query select v_n > 0;
end;
$fn$;
revoke all on function public.services_set_store(time, time, int, boolean, text, text) from public, anon, authenticated;
grant execute on function public.services_set_store(time, time, int, boolean, text, text) to authenticated;

select 'part 2 of 8 done' as "120_part2";
