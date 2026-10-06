-- 131: the saved home position and address of my own account (signups),
-- falling back to the listing. Used by the Go online screen.
create or replace function public.services_my_listing_point()
returns table (lat double precision, lng double precision, address_line text,
               locality text, city text, state text, pincode text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(g.home_lat, w.lat), coalesce(g.home_lng, w.lng),
         coalesce(nullif(g.address, ''), w.address_line)::text,
         w.locality::text, coalesce(g.city, w.city)::text,
         coalesce(g.state, w.state)::text, coalesce(g.pincode, w.pincode)::text
    from public.services_signups g
    left join public.services_workers w on w.user_id = g.id
   where g.id = public.services_account_id()
   order by w.created_at desc nulls last
   limit 1;
$$;
revoke all on function public.services_my_listing_point() from public, anon, authenticated;
grant execute on function public.services_my_listing_point() to authenticated;
notify pgrst, 'reload schema';
select 'done' as "131";
