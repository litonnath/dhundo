-- ===========================================================================
-- 126_part3.sql -- the booking list hides requests declined or cancelled more
-- than 24 hours ago, and the clean-up runs once now.
-- ===========================================================================
drop function if exists public.services_my_bookings();
create function public.services_my_bookings()
returns table (id uuid, role text, status text, period text, start_on date, note text,
               other_name text, other_phone text, created_at timestamptz,
               start_at timestamptz, duration_mins int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select b.id, 'customer'::text, b.status, b.period, b.start_on, b.note,
         w.full_name::text,
         case when b.status = 'accepted' then w.phone::text end, b.created_at,
         b.start_at, b.duration_mins
    from public.services_bookings b
    join public.services_workers w on w.id = b.worker_id
   where b.customer_id = public.services_account_id()
     and (b.closed_at is null or b.closed_at > now() - interval '24 hours')
  union all
  select b.id, 'worker'::text, b.status, b.period, b.start_on, b.note,
         c.full_name::text,
         case when b.status = 'accepted' then c.phone::text end, b.created_at,
         b.start_at, b.duration_mins
    from public.services_bookings b
    join public.services_workers w on w.id = b.worker_id and w.user_id = public.services_account_id()
    join public.services_signups c on c.id = b.customer_id
   where (b.closed_at is null or b.closed_at > now() - interval '24 hours')
  order by 9 desc;
$fn$;
revoke all on function public.services_my_bookings() from public, anon, authenticated;
grant execute on function public.services_my_bookings() to authenticated;

select public.services_purge_chats();
notify pgrst, 'reload schema';
select 'part 3 of 3 done' as "126_part3";
