-- ===========================================================================
-- 74_storage_sweep_fixes.sql
--
-- FIXES: the admin screen logging a string of
--
--   DELETE .../storage/v1/object/services-photos/<account>/<file>  400
--
-- every time it opens, for the same files, forever.
--
-- ---------------------------------------------------------------------------
-- WHY THE DELETES FAILED
-- ---------------------------------------------------------------------------
-- The Storage API deletes with DELETE ... RETURNING under the caller's RLS.
-- Postgres only lets a row through RETURNING if the caller could also SELECT
-- it, so a DELETE policy on its own is not enough: without a SELECT policy
-- the row is invisible, nothing is deleted, and Storage answers 400
-- "Object not found" -- the same answer it gives for a file that really is
-- gone. 73 added the admin DELETE policies but not the matching SELECT on
-- services-photos (a public bucket is readable by URL, which is not the same
-- as being visible to RLS).
--
-- The second source of 400s is a queued file that no longer exists at all
-- (removed by its owner, or by an earlier sweep whose mark_deleted call
-- never arrived). Storage cannot tell the browser "already gone" apart from
-- "not allowed", but SQL can: it reads storage.objects directly. So the
-- queue now closes such rows itself instead of handing them out again.
-- ===========================================================================

do $$
begin
  if to_regclass('public.services_storage_deletions') is null then
    raise exception 'Run 73 first.';
  end if;
end $$;

-- ---- admins can SEE what they are allowed to delete ------------------------
drop policy if exists services_ids_admin_select_74    on storage.objects;
drop policy if exists services_photos_admin_select_74 on storage.objects;

create policy services_ids_admin_select_74 on storage.objects
  for select to authenticated
  using (bucket_id = 'services-ids' and public.services_is_admin());

create policy services_photos_admin_select_74 on storage.objects
  for select to authenticated
  using (bucket_id = 'services-photos' and public.services_is_admin());

-- ---- the queue stops handing out files that no longer exist ---------------
-- No longer STABLE: it writes. Same signature and grants as 73.
drop function if exists public.services_pending_deletions(int);

create or replace function public.services_pending_deletions(p_limit int default 50)
returns table (id bigint, bucket_id text, name text, queued_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.services_is_admin() then
    return;
  end if;

  update public.services_storage_deletions d
     set done_at = now(), last_error = null
   where d.done_at is null
     and not exists (
       select 1 from storage.objects o
        where o.bucket_id = d.bucket_id and o.name = d.name
     );

  return query
  select d.id, d.bucket_id::text, d.name::text, d.queued_at
    from public.services_storage_deletions d
   where d.done_at is null
   order by d.queued_at
   limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

revoke all on function public.services_pending_deletions(int) from public, anon, authenticated;
grant execute on function public.services_pending_deletions(int) to authenticated;

-- ===========================================================================
-- VERIFY
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'admin_select_policies', (select count(*) from pg_policies
                             where schemaname='storage' and tablename='objects'
                               and policyname in ('services_ids_admin_select_74',
                                                  'services_photos_admin_select_74')),
  'admin_delete_policies', (select count(*) from pg_policies
                             where schemaname='storage' and tablename='objects'
                               and policyname in ('services_ids_admin_delete',
                                                  'services_photos_admin_delete')),
  'pending_now', (select count(*) from public.services_storage_deletions where done_at is null),
  'pending_missing_file', (select count(*) from public.services_storage_deletions d
                            where d.done_at is null
                              and not exists (select 1 from storage.objects o
                                               where o.bucket_id = d.bucket_id and o.name = d.name)),
  'expected', 'admin_select_policies 2; admin_delete_policies 2; pending_missing_file drops to 0 after the admin screen next opens'
)) as "74_verify";
