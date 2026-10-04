-- ===========================================================================
-- 111_part2.sql -- storage rules for admins are rebuilt so they call the new
-- services_is_admin() (policies remember a function, not its name).
-- ===========================================================================
drop policy if exists services_ids_admin_delete on storage.objects;
drop policy if exists services_photos_admin_delete on storage.objects;
drop policy if exists services_ids_admin_select_74 on storage.objects;
drop policy if exists services_photos_admin_select_74 on storage.objects;

create policy services_ids_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'services-ids' and public.services_is_admin());
create policy services_photos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'services-photos' and public.services_is_admin());
create policy services_ids_admin_select_74 on storage.objects
  for select to authenticated
  using (bucket_id = 'services-ids' and public.services_is_admin());
create policy services_photos_admin_select_74 on storage.objects
  for select to authenticated
  using (bucket_id = 'services-photos' and public.services_is_admin());

select 'done' as "111_part2";
