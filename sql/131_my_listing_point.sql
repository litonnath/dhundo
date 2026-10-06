-- 131: the saved position and address of my own listing, so the Go online
-- screen can show and use what was set when the listing was made.
create or replace function public.services_my_listing_point()
returns table (lat double precision, lng double precision, address_line text,
               locality text, city text, state text, pincode text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select w.lat, w.lng, w.address_line::text, w.locality::text, w.city::text,
         w.state::text, w.pincode::text
    from public.services_workers w
   where w.user_id = public.services_account_id()
   order by w.created_at desc
   limit 1;
$$;
revoke all on function public.services_my_listing_point() from public, anon, authenticated;
grant execute on function public.services_my_listing_point() to authenticated;
notify pgrst, 'reload schema';
select 'done' as "131";
