-- ===========================================================================
-- 110_part6.sql -- the admin withdrawal list, with the hold and a flag for a
-- UPI id this person has never been paid to before.
-- ===========================================================================
drop function if exists public.services_admin_withdrawals(text);
create or replace function public.services_admin_withdrawals(p_status text default 'requested')
returns table (
  id uuid, amount_paise bigint, upi_id text, status text, note text,
  created_at timestamptz, full_name text, phone text, listings int,
  release_at timestamptz, new_upi boolean
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
             where x.user_id = w.account_id and x.status = 'approved'),
           w.release_at,
           not exists (select 1 from public.services_withdrawals o
                        where o.account_id = w.account_id and o.upi_id = w.upi_id
                          and o.status = 'paid' and o.id <> w.id)
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
select 'done' as "110_part6";
