-- 251_admin_person_listings.sql -- admin People tab: a person's listings, so one can be removed. Needs 70, 71 and 167.
create or replace function public.services_admin_person_listings(p_account uuid)
returns table (id uuid, name text, status text)
language plpgsql stable security definer set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then raise exception 'not_admin' using errcode = 'PT403'; end if;
  return query
    select w.id, coalesce(nullif(btrim(w.business_name), ''), w.full_name)::text, w.status::text
      from public.services_workers w where w.user_id = p_account order by w.id;
end;
$fn$;
revoke all on function public.services_admin_person_listings(uuid) from public, anon;
grant execute on function public.services_admin_person_listings(uuid) to authenticated;
notify pgrst, 'reload schema';
select 'done' as "251_admin_person_listings";
