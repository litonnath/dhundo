-- 140: the requests I made as a customer, with the worker they went to, so the
-- hire screen can show that I asked earlier and list them with details.
-- Only vehicles and machines (the Drivers group): not cooks, and not the
-- enquiries sent to a restaurant or shop.
create or replace function public.services_my_hire_requests()
returns table (id uuid, worker_id uuid, other_name text, trade_name text, status text,
               start_at timestamptz, duration_mins int, note text, created_at timestamptz,
               other_phone text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select b.id, b.worker_id, w.full_name::text, t.name_en::text, b.status,
         b.start_at, b.duration_mins, b.note, b.created_at,
         case when b.status = 'accepted' then w.phone::text end
    from public.services_bookings b
    join public.services_workers w on w.id = b.worker_id
    left join public.services_trades t on t.slug = w.trade_slug
   where b.customer_id = public.services_account_id()
     and t.group_name = 'Drivers'
     and coalesce(b.note, '') not like 'Enquiry:%'
     and (b.closed_at is null or b.closed_at > now() - interval '24 hours')
   order by b.created_at desc
   limit 60;
$fn$;
revoke all on function public.services_my_hire_requests() from public, anon, authenticated;
grant execute on function public.services_my_hire_requests() to authenticated;
notify pgrst, 'reload schema';
select 'done' as "140";
