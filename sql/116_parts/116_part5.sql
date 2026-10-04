-- ===========================================================================
-- 116_part5.sql -- owner: delete an item, switch orders on or off.
-- ===========================================================================
create or replace function public.services_menu_delete(p_id uuid)
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_n int;
begin
  delete from public.services_menu_items m
   using public.services_workers w
   where m.id = p_id and w.id = m.worker_id and w.user_id = public.services_account_id();
  get diagnostics v_n = row_count;
  return query select v_n > 0;
end;
$fn$;
revoke all on function public.services_menu_delete(uuid) from public, anon, authenticated;
grant execute on function public.services_menu_delete(uuid) to authenticated;

create or replace function public.services_set_accepting(p_on boolean)
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_n int;
begin
  update public.services_workers set accepting_orders = coalesce(p_on, true)
   where user_id = public.services_account_id() and status = 'approved';
  get diagnostics v_n = row_count;
  return query select v_n > 0;
end;
$fn$;
revoke all on function public.services_set_accepting(boolean) from public, anon, authenticated;
grant execute on function public.services_set_accepting(boolean) to authenticated;

select 'part 5 of 8 done' as "116_part5";
