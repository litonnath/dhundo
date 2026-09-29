-- ===========================================================================
-- 72_services_rejection_reason.sql
--
-- When an admin hides a listing, the person is told why.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS WORTH A MIGRATION
-- ---------------------------------------------------------------------------
-- Until now, hiding a listing did exactly nothing visible to its owner. Their
-- status quietly changed and they were left to notice that nobody was calling
-- any more. For somebody whose week's work depends on this, that is the worst
-- possible way to be moderated: no reason, no idea what to fix, no way to
-- come back. They cannot appeal a decision they were never told about.
--
-- So 'hidden' now carries a sentence, written by the admin and shown to the
-- person on their own page. It is stored on the listing rather than in a
-- separate log because it is not an audit trail -- it is a message to one
-- person about the state their listing is in right now, and it should
-- disappear the moment the listing is published, which it does below.
--
-- The reason is OPTIONAL at the database level and prompted for in the app.
-- Forcing it would mean an admin dealing with obvious spam has to compose a
-- sentence for a listing nobody will read; leaving it out entirely means the
-- honest cases go unexplained too.
-- ===========================================================================

do $$
begin
  if to_regclass('public.services_workers') is null then
    raise exception 'Run 55 through 71 first.';
  end if;
end $$;

alter table public.services_workers
  add column if not exists rejection_reason text,
  add column if not exists rejected_at      timestamptz;

-- ===========================================================================
-- SET STATUS, NOW WITH A REASON
--
-- 71 left services_admin_set_status at three arguments. Adding a fourth makes
-- a NEW function -- Postgres keys on the argument list -- so the old one is
-- dropped first or PostgREST meets two candidates and refuses the call as
-- ambiguous. This has bitten this project twice (65, 67).
--
-- The fourth argument has a default, so the app can keep calling it with
-- three and nothing breaks while the new build is deploying.
--
-- Body carried over from 68 -- gate, referral payout, ID destruction -- with
-- the reason handling added. Copied from the file, not retyped.
-- ===========================================================================
drop function if exists public.services_admin_set_status(uuid, text, boolean);
drop function if exists public.services_admin_set_status(uuid, text, boolean, text);

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
         -- Kept only while hidden. Publishing clears it, so a person who
         -- fixed the problem and was let back in does not keep reading the
         -- complaint about what they already put right.
         rejection_reason = case
                              when p_status = 'hidden' then coalesce(v_note, rejection_reason)
                              else null
                            end,
         rejected_at      = case
                              when p_status = 'hidden' then now()
                              else null
                            end,
         updated_at = now()
   where id = p_worker_id;

  if p_status = 'approved' then
    v_paid := public.services_pay_referral(p_worker_id);
  end if;

  if coalesce(p_verified, false) and v_path is not null then
    delete from storage.objects where bucket_id = 'services-ids' and name = v_path;
    update public.services_workers
       set id_doc_path = null, id_doc_uploaded_at = null
     where id = p_worker_id;
  end if;

  return query select true, (case when v_paid > 0 then 'ok_paid_referral' else 'ok' end)::text;
end;
$$;

revoke all on function public.services_admin_set_status(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.services_admin_set_status(uuid, text, boolean, text) to authenticated;

-- ===========================================================================
-- THE PERSON SEES IT
--
-- Appended to services_my_listing's columns rather than inserted among them,
-- so anything reading positionally is unaffected. 69's body, copied.
-- ===========================================================================
drop function if exists public.services_my_listing();

create or replace function public.services_my_listing()
returns table (
  id uuid, full_name text, business_name text, phone text,
  trade_slug text, trade_name text, other_trades text[],
  years_experience int, day_rate_min int, day_rate_max int,
  locality text, city text, state text, about text,
  photos text[], available boolean, verified boolean, status text,
  has_id_doc boolean, contact_views bigint, created_at timestamptz,
  avatar_url text, address_line text, landmark text, pincode text,
  address_public boolean,
  vehicle_number text, requires_vehicle boolean, requires_id boolean,
  gaps text[],
  city_id bigint, district text, loc_source text,
  rejection_reason text, rejected_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    w.id, w.full_name::text, w.business_name::text, w.phone::text,
    w.trade_slug::text, t.name_en::text, w.other_trades,
    w.years_experience, w.day_rate_min, w.day_rate_max,
    w.locality::text, w.city::text, w.state::text, w.about::text,
    w.photos, w.available, w.verified, w.status::text,
    (w.id_doc_path is not null),
    (select count(*) from public.services_contact_views v where v.worker_id = w.id),
    w.created_at,
    w.avatar_url::text, w.address_line::text, w.landmark::text, w.pincode::text,
    w.address_public,
    w.vehicle_number::text, t.requires_vehicle, t.requires_id,
    public.services_listing_gaps(w.id),
    w.city_id, w.district::text, w.loc_source::text,
    w.rejection_reason::text, w.rejected_at
  from public.services_workers w
  join public.services_trades t on t.slug = w.trade_slug
  where w.user_id = public.services_account_id();
$$;

revoke all on function public.services_my_listing() from public, anon, authenticated;
grant execute on function public.services_my_listing() to authenticated;

-- ===========================================================================
-- AND THE ADMIN SEES WHAT THEY WROTE LAST TIME
-- 67's body, plus two columns at the end.
-- ===========================================================================
drop function if exists public.services_admin_worker_detail(uuid);

create or replace function public.services_admin_worker_detail(p_worker_id uuid)
returns table (
  id uuid, full_name text, business_name text, phone text,
  trade_slug text, trade_name text, group_name text, other_trades text[],
  years_experience int, day_rate_min int, day_rate_max int,
  about text, languages text[], photos text[], avatar_url text,
  locality text, city text, state text,
  address_line text, landmark text, pincode text, address_public boolean,
  lat double precision, lng double precision, loc_source text,
  vehicle_number text, same_vehicle_count bigint,
  requires_vehicle boolean, requires_id boolean, gaps text[],
  has_id_doc boolean, id_doc_path text, id_doc_uploaded_at timestamptz,
  available boolean, verified boolean, status text, source text,
  contact_views bigint, created_at timestamptz, updated_at timestamptz,
  district text, account_id uuid, rejection_reason text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.services_is_admin() then
    return;
  end if;

  return query
  select
    w.id, w.full_name::text, w.business_name::text, w.phone::text,
    w.trade_slug::text, t.name_en::text, t.group_name::text, w.other_trades,
    w.years_experience, w.day_rate_min, w.day_rate_max,
    w.about::text, w.languages, w.photos, w.avatar_url::text,
    w.locality::text, w.city::text, w.state::text,
    w.address_line::text, w.landmark::text, w.pincode::text, w.address_public,
    w.lat, w.lng, w.loc_source::text,
    w.vehicle_number::text,
    (select count(*) from public.services_workers o
      where o.vehicle_number is not null
        and o.vehicle_number = w.vehicle_number
        and o.id <> w.id),
    t.requires_vehicle, t.requires_id,
    public.services_listing_gaps(w.id),
    (w.id_doc_path is not null), w.id_doc_path::text, w.id_doc_uploaded_at,
    w.available, w.verified, w.status::text, w.source::text,
    (select count(*) from public.services_contact_views v where v.worker_id = w.id),
    w.created_at, w.updated_at,
    w.district::text,
    -- So the admin screen can offer "delete this account" without a second
    -- lookup. Null for a listing an admin typed in by hand.
    w.user_id,
    w.rejection_reason::text
  from public.services_workers w
  join public.services_trades t on t.slug = w.trade_slug
  where w.id = p_worker_id;
end;
$$;

revoke all on function public.services_admin_worker_detail(uuid) from public, anon, authenticated;
grant execute on function public.services_admin_worker_detail(uuid) to authenticated;

-- ===========================================================================
-- VERIFY
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'reason_columns', (select count(*) from information_schema.columns
                      where table_schema='public' and table_name='services_workers'
                        and column_name in ('rejection_reason','rejected_at')),
  'set_status_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                            where n.nspname='public' and p.proname='services_admin_set_status'),
  'set_status_args', (select pg_get_function_identity_arguments(p.oid)
                       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                      where n.nspname='public' and p.proname='services_admin_set_status'),
  'my_listing_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                            where n.nspname='public' and p.proname='services_my_listing'),
  'detail_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                        where n.nspname='public' and p.proname='services_admin_worker_detail'),
  'hidden_with_reason', (select count(*) from public.services_workers
                          where status='hidden' and rejection_reason is not null),
  'approved_with_stale_reason', (select count(*) from public.services_workers
                                  where status='approved' and rejection_reason is not null),
  'expected', 'reason_columns 2; every overload count 1; approved_with_stale_reason 0'
)) as "72_verify";
