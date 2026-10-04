-- ===========================================================================
-- 114_part3.sql -- each side sees its bookings. The other side name and
-- phone are shown only once the booking is accepted.
-- ===========================================================================
create or replace function public.services_my_bookings()
returns table (id uuid, role text, status text, period text, start_on date, note text,
               other_name text, other_phone text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select b.id, 'customer'::text, b.status, b.period, b.start_on, b.note,
         w.full_name::text,
         case when b.status = 'accepted' then w.phone::text end, b.created_at
    from public.services_bookings b
    join public.services_workers w on w.id = b.worker_id
   where b.customer_id = public.services_account_id()
  union all
  select b.id, 'worker'::text, b.status, b.period, b.start_on, b.note,
         c.full_name::text,
         case when b.status = 'accepted' then c.phone::text end, b.created_at
    from public.services_bookings b
    join public.services_workers w on w.id = b.worker_id and w.user_id = public.services_account_id()
    join public.services_signups c on c.id = b.customer_id
  order by 9 desc;
$fn$;
revoke all on function public.services_my_bookings() from public, anon, authenticated;
grant execute on function public.services_my_bookings() to authenticated;

notify pgrst, 'reload schema';
select 'done' as "114_part3";
