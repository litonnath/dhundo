-- ===========================================================================
-- 73_storage_deletion_queue.sql
--
-- FIXES A LIVE BREAKAGE: pressing "Mark checked" on a listing failed with
--
--   42501  Direct deletion from storage tables is not allowed.
--          Use the Storage API instead.
--
-- ---------------------------------------------------------------------------
-- WHAT I GOT WRONG
-- ---------------------------------------------------------------------------
-- 60 destroyed the ID document by deleting its row out of storage.objects
-- inside the same statement that marked somebody verified. That worked when
-- it was written and Supabase has since forbidden it -- storage.objects is
-- their bookkeeping table, and removing a row from it would leave the actual
-- FILE in the bucket with nothing pointing at it. Their guard is right; my
-- code was wrong.
--
-- 67, 68, 70 and 72 each carried that same block forward verbatim, which is
-- normally the careful thing to do -- it is how the ID-destruction logic
-- survived four rewrites intact. Here it propagated the fault to every
-- function that touches a file. Every path that deletes anything has been
-- broken since Supabase turned the guard on, which means:
--
--   * "Mark checked" has been failing, so nobody has been verified;
--   * and because the function raises before it returns, the STATUS change
--     was rolled back with it. The listing did not publish either.
--
-- ---------------------------------------------------------------------------
-- HOW IT WORKS NOW, AND WHAT THAT COSTS
-- ---------------------------------------------------------------------------
-- SQL cannot delete a file, so it stops trying. Instead it writes the file's
-- path to a queue and clears the reference; something holding an HTTP client
-- then calls the Storage API and marks the row done. The admin's browser
-- does that immediately after any action that queues one, so in practice the
-- file is gone seconds later.
--
-- BE CLEAR ABOUT THE WEAKENING. 60 promised the ID existed only between
-- upload and verification, destroyed in the same breath. That promise is now
-- "destroyed moments later, by the browser that verified them". If the admin
-- closes the tab at exactly the wrong moment, an ID document sits in a
-- private bucket until the next sweep. The queue makes that recoverable
-- rather than invisible -- services_pending_deletions() will still be
-- holding it -- but it is no longer instantaneous, and it should not be
-- described as if it were.
--
-- THE ROBUST VERSION, when this matters more than it does today: a scheduled
-- Edge Function with the service_role key that drains this queue through the
-- Storage API every few minutes. Then no human has to be present. The queue
-- below is already the right shape for it; only the drainer changes.
-- ===========================================================================

do $$
begin
  if to_regclass('public.services_workers') is null then
    raise exception 'Run 55 through 72 first.';
  end if;
end $$;

-- ===========================================================================
-- THE QUEUE
-- ===========================================================================
create table if not exists public.services_storage_deletions (
  id         bigserial primary key,
  bucket_id  text not null,
  name       text not null,
  queued_at  timestamptz not null default now(),
  done_at    timestamptz,
  attempts   int not null default 0,
  last_error text
);

-- One outstanding request per file. Re-queuing something already waiting is
-- a no-op rather than a second row; a file deleted and later re-uploaded can
-- be queued again, because the old row is done by then.
create unique index if not exists services_storage_deletions_open
  on public.services_storage_deletions (bucket_id, name)
  where done_at is null;

create index if not exists services_storage_deletions_pending
  on public.services_storage_deletions (queued_at)
  where done_at is null;

alter table public.services_storage_deletions enable row level security;
revoke all on public.services_storage_deletions from public, anon, authenticated;

-- The one place that writes to the queue. Not granted to anybody: it is
-- called from the definer functions below, which have already decided the
-- caller is allowed to destroy the thing.
create or replace function public.services_queue_delete(p_bucket text, p_name text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.services_storage_deletions (bucket_id, name)
  select p_bucket, p_name
   where coalesce(btrim(p_name), '') <> ''
  on conflict do nothing;
$$;

revoke all on function public.services_queue_delete(text, text) from public, anon, authenticated;

-- ===========================================================================
-- WHAT THE SWEEPER READS AND WRITES
-- ===========================================================================
drop function if exists public.services_pending_deletions(int);

create or replace function public.services_pending_deletions(p_limit int default 50)
returns table (id bigint, bucket_id text, name text, queued_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.id, d.bucket_id::text, d.name::text, d.queued_at
    from public.services_storage_deletions d
   where d.done_at is null
     and public.services_is_admin()
   order by d.queued_at
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.services_pending_deletions(int) from public, anon, authenticated;
grant execute on function public.services_pending_deletions(int) to authenticated;

create or replace function public.services_mark_deleted(p_id bigint, p_error text default null)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.services_is_admin() then
    return query select false, 'not_admin'::text; return;
  end if;

  if p_error is not null and btrim(p_error) <> '' then
    -- A failure is recorded, not hidden. A row whose attempts keep climbing
    -- is a file that cannot be removed, and somebody should know.
    update public.services_storage_deletions
       set attempts = attempts + 1, last_error = left(btrim(p_error), 300)
     where id = p_id and done_at is null;
    return query select false, 'recorded'::text; return;
  end if;

  update public.services_storage_deletions
     set done_at = now(), last_error = null
   where id = p_id and done_at is null;

  if not found then
    return query select false, 'not_found'::text; return;
  end if;
  return query select true, 'deleted'::text;
end;
$$;

revoke all on function public.services_mark_deleted(bigint, text) from public, anon, authenticated;
grant execute on function public.services_mark_deleted(bigint, text) to authenticated;

-- ===========================================================================
-- AN ADMIN MAY DELETE THROUGH THE STORAGE API
--
-- 60 gave admins READ on services-ids and gave owners delete on their own
-- prefix. Nobody could delete somebody else's file -- which was fine while
-- SQL did the deleting and is not fine now that the admin's browser has to.
-- ===========================================================================
drop policy if exists services_ids_admin_delete    on storage.objects;
drop policy if exists services_photos_admin_delete on storage.objects;

create policy services_ids_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'services-ids' and public.services_is_admin());

create policy services_photos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'services-photos' and public.services_is_admin());

-- ===========================================================================
-- THE THREE FUNCTIONS THAT USED TO DELETE
--
-- Bodies carried over unchanged except that the delete becomes a queue
-- write. Copied from their files, not retyped.
-- ===========================================================================

-- ---- 72's set_status ------------------------------------------------------
create or replace function public.services_admin_set_status(
  p_worker_id uuid,
  p_status    text,
  p_verified  boolean default null,
  p_reason    text    default null
)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_path text;
  v_gaps text[];
  v_paid bigint := 0;
  v_note text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.services_is_admin() then
    return query select false, 'not_admin'::text; return;
  end if;
  if p_status not in ('pending','approved','hidden') then
    return query select false, 'bad_status'::text; return;
  end if;

  if not exists (select 1 from public.services_workers where id = p_worker_id) then
    return query select false, 'not_found'::text; return;
  end if;

  if p_status = 'approved' then
    v_gaps := public.services_listing_gaps(p_worker_id);
    if array_length(v_gaps, 1) > 0 then
      return query select false, ('missing:' || array_to_string(v_gaps, ','))::text;
      return;
    end if;
  end if;

  select id_doc_path into v_path from public.services_workers where id = p_worker_id;

  update public.services_workers
     set status     = p_status,
         verified   = coalesce(p_verified, verified),
         rejection_reason = case
                              when p_status = 'hidden' then coalesce(v_note, rejection_reason)
                              else null
                            end,
         rejected_at      = case when p_status = 'hidden' then now() else null end,
         updated_at = now()
   where id = p_worker_id;

  if p_status = 'approved' then
    v_paid := public.services_pay_referral(p_worker_id);
  end if;

  -- Verified: the document has served its purpose. QUEUED for destruction
  -- rather than deleted here -- see this file's header.
  if coalesce(p_verified, false) and v_path is not null then
    perform public.services_queue_delete('services-ids', v_path);
    update public.services_workers
       set id_doc_path = null, id_doc_uploaded_at = null
     where id = p_worker_id;
  end if;

  return query select true, (case when v_paid > 0 then 'ok_paid_referral' else 'ok' end)::text;
end;
$$;

revoke all on function public.services_admin_set_status(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.services_admin_set_status(uuid, text, boolean, text) to authenticated;

-- ---- 60's discard ---------------------------------------------------------
create or replace function public.services_discard_id_doc(p_worker_id uuid default null)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id   uuid;
  v_path text;
begin
  if p_worker_id is not null then
    if not public.services_is_admin() then
      return query select false, 'not_admin'::text; return;
    end if;
    select id, id_doc_path into v_id, v_path
      from public.services_workers where id = p_worker_id;
  else
    select w.id, w.id_doc_path into v_id, v_path
      from public.services_workers w
     where w.user_id = public.services_account_id();
  end if;

  if v_id is null then
    return query select false, 'not_found'::text; return;
  end if;

  if v_path is not null then
    perform public.services_queue_delete('services-ids', v_path);
  end if;

  update public.services_workers
     set id_doc_path = null, id_doc_uploaded_at = null, updated_at = now()
   where id = v_id;

  return query select true, 'discarded'::text;
end;
$$;

revoke all on function public.services_discard_id_doc(uuid) from public, anon, authenticated;
grant execute on function public.services_discard_id_doc(uuid) to authenticated;

-- ---- 70's destroyer -------------------------------------------------------
--
-- This one deleted by PREFIX, which the queue cannot express -- a queue row
-- names one file. So it reads the object names first and queues each. That
-- read is allowed; only deletion is blocked.
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
  o        record;
begin
  select w.user_id, w.id_doc_path into v_owner, v_idpath
    from public.services_workers w where w.id = p_worker_id;

  if not found then
    return query select false, 'not_found'::text, 0; return;
  end if;

  if v_idpath is not null then
    perform public.services_queue_delete('services-ids', v_idpath);
    v_gone := v_gone + 1;
  end if;

  -- Every file under this account's prefix, including uploads whose save
  -- never completed. One account has at most one listing, so the prefix is
  -- exactly this person's files.
  if v_owner is not null then
    for o in
      select bucket_id, name from storage.objects
       where bucket_id in ('services-photos', 'services-ids')
         and name like v_owner::text || '/%'
    loop
      perform public.services_queue_delete(o.bucket_id, o.name);
      v_gone := v_gone + 1;
    end loop;
  end if;

  delete from public.services_workers where id = p_worker_id;

  return query select true, 'deleted'::text, v_gone;
end;
$$;

revoke all on function public.services_destroy_listing(uuid) from public, anon, authenticated;

-- ===========================================================================
-- ANYTHING ALREADY ORPHANED
--
-- Every ID document whose listing was verified while the delete was failing
-- is still in the bucket. The failure rolled the whole statement back, so
-- id_doc_path was never cleared and these are findable -- but queue anything
-- that is loose regardless.
-- ===========================================================================
insert into public.services_storage_deletions (bucket_id, name)
select o.bucket_id, o.name
  from storage.objects o
 where o.bucket_id = 'services-ids'
   and not exists (
     select 1 from public.services_workers w where w.id_doc_path = o.name
   )
on conflict do nothing;

-- ===========================================================================
-- VERIFY
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'queue_table', (to_regclass('public.services_storage_deletions') is not null),
  'queue_grants_to_clients', (select count(*) from information_schema.role_table_grants
                               where table_schema='public'
                                 and table_name='services_storage_deletions'
                                 and grantee in ('anon','authenticated')),
  'pending_now', (select count(*) from public.services_storage_deletions where done_at is null),
  'sql_still_deletes_storage', (
     select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('services_admin_set_status','services_discard_id_doc',
                          'services_destroy_listing')
        and pg_get_functiondef(p.oid) ~* 'delete\s+from\s+storage\.objects'),
  'admin_delete_policies', (select count(*) from pg_policies
                             where schemaname='storage' and tablename='objects'
                               and policyname in ('services_ids_admin_delete',
                                                  'services_photos_admin_delete')),
  'set_status_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                            where n.nspname='public' and p.proname='services_admin_set_status'),
  'ids_still_held', (select count(*) from public.services_workers where id_doc_path is not null),
  'expected', 'queue_table true; queue_grants_to_clients 0; sql_still_deletes_storage 0; admin_delete_policies 2; set_status_overloads 1'
)) as "73_verify";
