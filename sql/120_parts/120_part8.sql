-- ===========================================================================
-- 120_part8.sql -- the same for the order switch.
-- ===========================================================================
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
   where user_id = public.services_account_id() and status in ('approved', 'pending');
  get diagnostics v_n = row_count;
  return query select v_n > 0;
end;
$fn$;
revoke all on function public.services_set_accepting(boolean) from public, anon, authenticated;
grant execute on function public.services_set_accepting(boolean) to authenticated;

notify pgrst, 'reload schema';
select 'part 8 of 8 done' as "120_part8";
