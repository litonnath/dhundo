-- ===========================================================================
-- 70_services_delete_listing.sql
--
-- Deleting a listing -- by the person it belongs to, or by an admin.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A REAL DELETE AND NOT A STATUS CHANGE
-- ---------------------------------------------------------------------------
-- The tempting version is `status = 'deleted'`: reversible, keeps the
-- history, one line of code. It is the wrong answer here.
--
-- A listing holds a photograph of somebody's face, their phone number, and
-- often the lane they live on. When a person taps Delete they are not asking
-- for their row to be hidden from a query -- they are asking for their face
-- to stop being on the internet. A soft delete leaves the photo sitting in a
-- PUBLIC storage bucket, readable by anyone with the URL, for as long as the
-- database lives. That is not a tidiness problem, it is the thing they were
-- trying to prevent.
--
-- So this removes the row AND the files. What survives is deliberate:
--
--   * The ACCOUNT (services_signups). They can sign in and list again; their
--     phone number is their identity, not part of the listing.
--   * The WALLET LEDGER, including any ₹3 somebody earned for referring
--     them. The ledger is append-only by design (see 66) and money history
--     that can be erased by the other party deleting something is not a
--     ledger. A referral already paid stays paid -- and cannot be paid twice
--     if they list again, because 68's unique index is on the pair of
--     ACCOUNTS, which both still exist.
--   * services_contact_views goes, by the ON DELETE CASCADE that 55 already
--     put on it. Those rows are "who looked at this worker", and the worker
--     is gone.
--
-- ---------------------------------------------------------------------------
-- WHAT CANNOT BE UNDONE, SAID PLAINLY
-- ---------------------------------------------------------------------------
-- Everything. There is no recycle bin, the photos are destroyed, and the
-- contact-view count resets. The app asks for confirmation and says so in
-- those words. If you later want an admin-only undo, the thing to add is an
-- archive table written inside this same function -- not a status flag,
-- because a status flag would not protect the photos.
-- ===========================================================================

do $$
begin
  if to_regclass('public.services_workers') is null then
    raise exception 'Run 55 through 69 first.';
  end if;
end $$;

-- ===========================================================================
-- THE SHARED PART
--
-- One function does the work; the two entry points below decide who is
-- allowed to call it. Keeping the destruction in a single place is the point:
-- if the worker-side delete cleaned up storage and the admin-side did not,
-- the bucket would fill with the faces of people an admin removed.
--
-- NOT granted to anyone. It is called only from the two functions below,
-- which check permission first.
-- ===========================================================================
create or replace function public.services_destroy_listing(p_worker_id uuid)
returns table (ok boolean, reason text, photos_removed int)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner  uuid;
  v_idpath text;
  v_gone   int := 0;
begin
  select w.user_id, w.id_doc_path into v_owner, v_idpath
    from public.services_workers w where w.id = p_worker_id;

  if not found then
    return query select false, 'not_found'::text, 0; return;
  end if;

  -- THE ID DOCUMENT, first and by exact path. 60 destroys this at
  -- verification; a listing deleted before ever being verified still has one
  -- sitting in the private bucket, and it must not outlive the listing.
  if v_idpath is not null then
    delete from storage.objects
     where bucket_id = 'services-ids' and name = v_idpath;
  end if;

  -- THE PHOTOS AND THE FACE. Deleted by owner prefix rather than by matching
  -- the URLs in `photos`, because the two can disagree: an upload that
  -- succeeded while the save that followed it failed leaves a file in the
  -- bucket that no row references. Those orphans belong to this person too,
  -- and this is the only moment anything will ever clean them up.
  --
  -- 60's storage policies put every upload under '<account_id>/', and one
  -- account has at most one listing, so the prefix is exactly this person's
  -- files and nobody else's.
  if v_owner is not null then
    delete from storage.objects
     where bucket_id in ('services-photos', 'services-ids')
       and name like v_owner::text || '/%';
    get diagnostics v_gone = row_count;
  end if;

  -- The row last, so a failure above does not leave files orphaned with no
  -- row to find them from.
  delete from public.services_workers where id = p_worker_id;

  return query select true, 'deleted'::text, v_gone;
end;
$$;

revoke all on function public.services_destroy_listing(uuid) from public, anon, authenticated;

-- ===========================================================================
-- THE PERSON DELETES THEIR OWN
--
-- No worker id parameter. The listing is found from the token, exactly as
-- services_my_listing() does -- 59 had to remove a caller-supplied id from
-- services_reveal_contact() after it turned out anyone could pass somebody
-- else's, and a delete is a far worse thing to get that wrong on.
-- ===========================================================================
create or replace function public.services_delete_my_listing()
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account uuid := public.services_account_id();
  v_id      uuid;
  r         record;
begin
  if v_account is null then
    return query select false, 'not_signed_in'::text; return;
  end if;

  select w.id into v_id from public.services_workers w where w.user_id = v_account;
  if v_id is null then
    return query select false, 'no_listing'::text; return;
  end if;

  select * into r from public.services_destroy_listing(v_id);
  return query select r.ok, r.reason;
end;
$$;

revoke all on function public.services_delete_my_listing() from public, anon, authenticated;
grant execute on function public.services_delete_my_listing() to authenticated;

-- ===========================================================================
-- AN ADMIN DELETES ANY
--
-- For a listing that is a duplicate, a test row, or somebody who asked to be
-- removed by phone. Hiding is still the right answer for a listing that is
-- merely wrong or disputed -- it is reversible and this is not -- so the app
-- offers Hide first and keeps Delete behind a confirmation.
-- ===========================================================================
create or replace function public.services_admin_delete_listing(p_worker_id uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
begin
  if not public.services_is_admin() then
    return query select false, 'not_admin'::text; return;
  end if;
  if p_worker_id is null then
    return query select false, 'not_found'::text; return;
  end if;

  select * into r from public.services_destroy_listing(p_worker_id);
  return query select r.ok, r.reason;
end;
$$;

revoke all on function public.services_admin_delete_listing(uuid) from public, anon, authenticated;
grant execute on function public.services_admin_delete_listing(uuid) to authenticated;

-- ===========================================================================
-- VERIFY
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'destroy_exists', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                      where n.nspname='public' and p.proname='services_destroy_listing'),
  'destroy_granted_to_clients', (select count(*) from information_schema.role_routine_grants
                                  where routine_schema='public'
                                    and routine_name='services_destroy_listing'
                                    and grantee in ('anon','authenticated')),
  'self_delete_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                             where n.nspname='public' and p.proname='services_delete_my_listing'),
  'admin_delete_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                              where n.nspname='public' and p.proname='services_admin_delete_listing'),
  'contact_views_cascades', (select count(*) from pg_constraint
                              where confrelid='public.services_workers'::regclass
                                and contype='f' and confdeltype='c'),
  'listings', (select count(*) from public.services_workers),
  'expected', 'destroy_exists 1; destroy_granted_to_clients 0; both delete overloads 1; contact_views_cascades at least 1'
)) as "70_verify";
