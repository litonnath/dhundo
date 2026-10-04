-- ===========================================================================
-- 104_admin_withdrawals.sql -- run after 103_part2.sql.
-- The list the admin screen shows: withdrawal requests with the name and
-- phone of the person, newest first. Admins only.
-- ===========================================================================
create or replace function public.services_admin_withdrawals(p_status text default 'requested')
returns table (
  id uuid, amount_paise bigint, upi_id text, status text, note text,
  created_at timestamptz, full_name text, phone text, listings int
)
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
    select w.id, w.amount_paise, w.upi_id, w.status, w.note, w.created_at,
           s.full_name::text, s.phone::text,
           (select count(*)::int from public.services_workers x
             where x.user_id = w.account_id and x.status = 'approved')
      from public.services_withdrawals w
      join public.services_signups s on s.id = w.account_id
     where p_status is null or w.status = p_status
     order by w.created_at desc
     limit 100;
end;
$fn$;

revoke all on function public.services_admin_withdrawals(text) from public, anon, authenticated;
grant execute on function public.services_admin_withdrawals(text) to authenticated;

notify pgrst, 'reload schema';
select 'done' as "104_admin_withdrawals";
