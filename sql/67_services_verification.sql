-- ===========================================================================
-- 67_services_verification.sql
--
-- Three things:
--   1. A vehicle registration number, for the trades that drive one.
--   2. An ID document that is REQUIRED rather than optional, for the trades
--      whose work happens inside somebody's home.
--   3. A full detail view for the admin, so a person is read properly before
--      they are published rather than approved off a row in a list.
--
-- ---------------------------------------------------------------------------
-- ON MAKING THE ID MANDATORY -- THIS CHANGES YOUR POSITION, READ IT
-- ---------------------------------------------------------------------------
-- 60 stored an ID document because somebody chose to send one. This file
-- makes it a condition of being published for a category of work. That is a
-- different thing legally and morally, and it is worth being clear-eyed:
--
--   * The people affected -- cooks, maids, cleaners, carers -- are mostly
--     women working alone, with the least margin for error of anyone in this
--     directory. You are requiring them to hand over identity documents to a
--     stranger's website before they can earn.
--   * Most of them will reach for Aadhaar, because it is the card they have.
--     Under the Aadhaar Act 2016 and UIDAI's regulations a private entity
--     storing Aadhaar numbers or card images is restricted, and "they
--     uploaded it voluntarily" is a weaker defence once uploading is the
--     price of being listed.
--
-- What this file does about that, and what it deliberately does not:
--
--   * ANY government photo ID is accepted. The app says so, and says to
--     cover the Aadhaar number if that is the card being used. Nothing here
--     asks for, parses or stores an ID number -- not even the last digits.
--   * The requirement bites at APPROVAL, not at listing. Somebody can fill
--     in their details and be told what is still needed; they are not
--     stopped at the door by a document they have to go and photograph. The
--     admin cannot publish them until it is there, which is the same safety
--     outcome without losing the person at the first screen.
--   * 60's delete-at-verification stays exactly as it was, and is now the
--     load-bearing part: the file exists between upload and your check and
--     then it is gone. Verified = true is a fact about YOUR check, not a
--     copy of their identity.
--
-- If this grows beyond a few hundred people, take advice before it does.
-- The safer long-term shape is DigiLocker or Aadhaar offline e-KYC, where
-- you receive a signed assertion and never hold the document at all.
--
-- ---------------------------------------------------------------------------
-- WHY FLAGS ON TRADES AND NOT A LIST OF GROUP NAMES IN HERE
-- ---------------------------------------------------------------------------
-- "Whoever works inside the house" is not a group. An electrician comes
-- inside; a tiffin supplier does not; a driver is inside a car with you,
-- which is its own kind of alone-with-a-stranger. Hardcoding 'Home &
-- Domestic' in a function would be wrong on the first week and would need a
-- migration to fix. Two booleans on services_trades put the judgement where
-- it can be changed with an UPDATE.
-- ===========================================================================

do $$
begin
  if to_regclass('public.services_workers') is null
     or to_regclass('public.services_trades') is null then
    raise exception 'Run 55 through 60 first.';
  end if;
end $$;

-- ===========================================================================
-- WHAT EACH TRADE REQUIRES
-- ===========================================================================
alter table public.services_trades
  add column if not exists requires_vehicle boolean not null default false,
  add column if not exists requires_id      boolean not null default false;

-- Seeded from the groups as they stand, ONLY for rows still at the default.
-- A re-run must not undo a judgement made by hand in the admin screen, so
-- this is guarded by a marker column rather than being a blanket UPDATE.
alter table public.services_trades
  add column if not exists requirements_seeded boolean not null default false;

update public.services_trades
   set requires_vehicle = (group_name = 'Drivers'),
       -- Inside somebody's home, or alone with them in a vehicle. Drivers are
       -- included on purpose: a woman getting into a stranger's car at night
       -- is the same trust problem as a stranger in her kitchen.
       requires_id      = (group_name in ('Drivers', 'Home & Domestic')),
       requirements_seeded = true
 where requirements_seeded = false;

-- ===========================================================================
-- THE VEHICLE NUMBER
--
-- NOT in the anon/authenticated column grants, like phone and address_line
-- before it. A plate identifies a vehicle, a vehicle identifies a person and
-- often where they park it overnight. The passenger who is about to get in
-- needs it; somebody scrolling the directory does not. It goes out through
-- services_reveal_contact() with the phone number, which is already logged
-- and rate-limited.
-- ===========================================================================
alter table public.services_workers
  add column if not exists vehicle_number text;

-- Normalised on the way in: people write "TR 01 AB 1234", "tr-01-ab-1234"
-- and "TR01AB1234" and mean one vehicle. Without this the same car is three
-- different strings and the duplicate check below finds nothing.
create or replace function public.services_normalize_plate(p text)
returns text
language sql
immutable
as $$
  select nullif(upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')), '')
$$;

-- Deliberately lenient. India has the standard series (TR01AB1234), the
-- newer BH series (22BH1234AA), old single-letter series, and plenty of
-- legitimate plates that match none of the tidy patterns people post online.
-- Rejecting a real plate because the regex was written from a blog post is
-- worse than accepting an odd one an admin will see anyway: this is a
-- typo-catcher, not an authority.
create or replace function public.services_valid_plate(p text)
returns boolean
language sql
immutable
as $$
  select case
    when public.services_normalize_plate(p) is null then false
    else public.services_normalize_plate(p) ~ '^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{3,4}$'
      or public.services_normalize_plate(p) ~ '^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$'
  end
$$;

alter table public.services_workers
  drop constraint if exists services_workers_plate_shape;
alter table public.services_workers
  add constraint services_workers_plate_shape
  check (vehicle_number is null or public.services_valid_plate(vehicle_number));

create index if not exists services_workers_vehicle_idx
  on public.services_workers (vehicle_number)
  where vehicle_number is not null;

-- ===========================================================================
-- SAVING IT
--
-- services_update_my_listing gains one parameter, which means a NEW function
-- signature -- Postgres treats a different argument list as a different
-- function, so without the DROP below there would be two overloads and
-- PostgREST would refuse the call as ambiguous. 65 hit exactly this.
--
-- The body is copied from 65 rather than rewritten from memory. Rewriting
-- from memory is how 57 silently lost two columns.
-- ===========================================================================
drop function if exists public.services_update_my_listing(text, text, text, text, text[], int, int, int, text, text, text, text, text[], boolean, text, text, text, text, text, boolean);
drop function if exists public.services_update_my_listing(text, text, text, text, text[], int, int, int, text, text, text, text, text[], boolean, text, text, text, text, text, boolean, text);

create or replace function public.services_update_my_listing(
  p_full_name        text    default null,
  p_business_name    text    default null,
  p_phone            text    default null,
  p_trade_slug       text    default null,
  p_other_trades     text[]  default null,
  p_years_experience int     default null,
  p_day_rate_min     int     default null,
  p_day_rate_max     int     default null,
  p_locality         text    default null,
  p_city             text    default null,
  p_state            text    default null,
  p_about            text    default null,
  p_photos           text[]  default null,
  p_available        boolean default null,
  p_id_doc_path      text    default null,
  p_avatar_url       text    default null,
  p_address_line     text    default null,
  p_landmark         text    default null,
  p_pincode          text    default null,
  p_address_public   boolean default null,
  p_vehicle_number   text    default null
)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id       uuid;
  v_row      public.services_workers%rowtype;
  v_account  uuid := public.services_account_id();
  v_reverify boolean := false;
  v_plate    text;
begin
  if v_account is null then
    return query select false, 'not_signed_in'::text; return;
  end if;

  select * into v_row from public.services_workers w where w.user_id = v_account;
  if not found then
    return query select false, 'no_listing'::text; return;
  end if;
  v_id := v_row.id;

  if p_trade_slug is not null
     and not exists (select 1 from public.services_trades t where t.slug = p_trade_slug) then
    return query select false, 'bad_trade'::text; return;
  end if;

  if p_other_trades is not null then
    if array_length(p_other_trades, 1) > 5 then
      return query select false, 'too_many_trades'::text; return;
    end if;
    if exists (
      select 1 from unnest(p_other_trades) s
       where not exists (select 1 from public.services_trades t where t.slug = s)
    ) then
      return query select false, 'bad_trade'::text; return;
    end if;
  end if;

  -- A changed phone number invalidates the in-person check: the tick means
  -- "we reached this person on this number", and it is a different number now.
  if p_phone is not null
     and regexp_replace(p_phone, '\D', '', 'g') <> regexp_replace(coalesce(v_row.phone, ''), '\D', '', 'g') then
    v_reverify := true;
  end if;

  -- Normalised here so that what is stored is what the duplicate check and
  -- the constraint both see.
  if p_vehicle_number is not null then
    if btrim(p_vehicle_number) = '' then
      v_plate := null;                       -- an explicit clear
    else
      v_plate := public.services_normalize_plate(p_vehicle_number);
      if not public.services_valid_plate(v_plate) then
        return query select false, 'bad_vehicle'::text; return;
      end if;
    end if;
  end if;

  update public.services_workers set
    full_name        = coalesce(nullif(btrim(coalesce(p_full_name,'')),''), full_name),
    business_name    = coalesce(p_business_name, business_name),
    phone            = coalesce(nullif(btrim(coalesce(p_phone,'')),''), phone),
    trade_slug       = coalesce(p_trade_slug, trade_slug),
    other_trades     = coalesce(p_other_trades, other_trades),
    years_experience = coalesce(p_years_experience, years_experience),
    day_rate_min     = coalesce(p_day_rate_min, day_rate_min),
    day_rate_max     = coalesce(p_day_rate_max, day_rate_max),
    locality         = coalesce(nullif(btrim(coalesce(p_locality,'')),''), locality),
    city             = coalesce(nullif(btrim(coalesce(p_city,'')),''), city),
    state            = coalesce(nullif(btrim(coalesce(p_state,'')),''), state),
    about            = coalesce(p_about, about),
    photos           = coalesce(p_photos, photos),
    available        = coalesce(p_available, available),
    avatar_url       = coalesce(p_avatar_url, avatar_url),
    id_doc_path      = coalesce(nullif(btrim(coalesce(p_id_doc_path,'')),''), id_doc_path),
    id_doc_uploaded_at = case
                           when nullif(btrim(coalesce(p_id_doc_path,'')),'') is not null
                           then now() else id_doc_uploaded_at
                         end,
    address_line     = coalesce(p_address_line, address_line),
    landmark         = coalesce(p_landmark, landmark),
    pincode          = coalesce(p_pincode, pincode),
    address_public   = coalesce(p_address_public, address_public),
    -- Null means "leave alone"; an empty string meant "clear it", which
    -- v_plate is already null for.
    vehicle_number   = case when p_vehicle_number is null then vehicle_number
                            else v_plate end,
    verified         = case when v_reverify then false else verified end,
    status           = case when v_reverify and status = 'approved' then 'pending' else status end,
    updated_at       = now()
  where id = v_id;

  return query select true, (case when v_reverify then 'saved_reverify' else 'saved' end)::text;
end;
$$;

revoke all on function public.services_update_my_listing(text, text, text, text, text[], int, int, int, text, text, text, text, text[], boolean, text, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.services_update_my_listing(text, text, text, text, text[], int, int, int, text, text, text, text, text[], boolean, text, text, text, text, text, boolean, text) to authenticated;

-- ===========================================================================
-- WHAT IS STILL MISSING
--
-- One function, called from three places: the worker's own to-do list, the
-- admin's review screen, and the approval gate. If they disagreed about what
-- "ready" means, somebody would be told they are done and then not published.
-- ===========================================================================
create or replace function public.services_listing_gaps(p_worker_id uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(array_agg(g), '{}')
  from (
    select 'vehicle_number' as g
      from public.services_workers w
      join public.services_trades t on t.slug = w.trade_slug
     where w.id = p_worker_id
       and t.requires_vehicle
       and w.vehicle_number is null
    union all
    -- verified already true means the document was seen and then destroyed,
    -- exactly as designed. Asking for it again would be asking somebody to
    -- re-upload an ID because the app forgot it had checked.
    select 'id_doc'
      from public.services_workers w
      join public.services_trades t on t.slug = w.trade_slug
     where w.id = p_worker_id
       and t.requires_id
       and w.id_doc_path is null
       and not w.verified
  ) gaps;
$$;

revoke all on function public.services_listing_gaps(uuid) from public, anon, authenticated;
grant execute on function public.services_listing_gaps(uuid) to authenticated;

-- ===========================================================================
-- THE APPROVAL GATE
--
-- Replaces 60's version. Same signature, so no overload problem, and the
-- ID-destruction block is carried over unchanged -- it is the whole reason
-- that file was written carefully.
--
-- The new part is the refusal: approving somebody who has not met their
-- trade's requirements now fails with a reason naming what is missing,
-- rather than quietly publishing them. An admin can still set 'hidden' or
-- 'pending' on an incomplete listing; it is only publishing that is gated.
-- ===========================================================================
create or replace function public.services_admin_set_status(
  p_worker_id uuid,
  p_status    text,
  p_verified  boolean default null
)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_path text;
  v_gaps text[];
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
      -- e.g. 'missing:vehicle_number,id_doc' -- the app splits on the colon
      -- and names each one in the admin's language.
      return query select false, ('missing:' || array_to_string(v_gaps, ','))::text;
      return;
    end if;
  end if;

  select id_doc_path into v_path from public.services_workers where id = p_worker_id;

  update public.services_workers
     set status     = p_status,
         verified   = coalesce(p_verified, verified),
         updated_at = now()
   where id = p_worker_id;

  -- Carried over from 60, unchanged: verified is the moment the document has
  -- done its job, so it goes in the same statement rather than in a nightly
  -- job somebody has to remember to write.
  if coalesce(p_verified, false) and v_path is not null then
    delete from storage.objects where bucket_id = 'services-ids' and name = v_path;
    update public.services_workers
       set id_doc_path = null, id_doc_uploaded_at = null
     where id = p_worker_id;
  end if;

  return query select true, 'ok'::text;
end;
$$;

revoke all on function public.services_admin_set_status(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.services_admin_set_status(uuid, text, boolean) to authenticated;

-- ===========================================================================
-- THE ADMIN'S FULL VIEW OF ONE PERSON
--
-- Everything held about them, in one call, so the decision to publish is made
-- against the whole record rather than the six columns that fit in a list.
-- Admin only, checked on the first line -- for anybody else the function
-- returns no rows at all rather than an error, which tells a prober nothing.
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
  contact_views bigint, created_at timestamptz, updated_at timestamptz
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
    -- Two people legitimately share a car -- an owner and the driver he
    -- employs -- so this is not a constraint. It is a number the admin
    -- should see, because five listings on one plate is a different story.
    (select count(*) from public.services_workers o
      where o.vehicle_number is not null
        and o.vehicle_number = w.vehicle_number
        and o.id <> w.id),
    t.requires_vehicle, t.requires_id,
    public.services_listing_gaps(w.id),
    (w.id_doc_path is not null), w.id_doc_path::text, w.id_doc_uploaded_at,
    w.available, w.verified, w.status::text, w.source::text,
    (select count(*) from public.services_contact_views v where v.worker_id = w.id),
    w.created_at, w.updated_at
  from public.services_workers w
  join public.services_trades t on t.slug = w.trade_slug
  where w.id = p_worker_id;
end;
$$;

revoke all on function public.services_admin_worker_detail(uuid) from public, anon, authenticated;
grant execute on function public.services_admin_worker_detail(uuid) to authenticated;

-- ===========================================================================
-- THE WORKER'S OWN VIEW GAINS THE SAME FACTS
--
-- So the to-do list can say "your vehicle number" rather than the person
-- discovering the requirement when an admin rejects them.
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
  gaps text[]
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
    public.services_listing_gaps(w.id)
  from public.services_workers w
  join public.services_trades t on t.slug = w.trade_slug
  where w.user_id = public.services_account_id();
$$;

revoke all on function public.services_my_listing() from public, anon, authenticated;
grant execute on function public.services_my_listing() to authenticated;

-- ===========================================================================
-- THE PLATE REACHES THE PASSENGER WITH THE PHONE NUMBER
--
-- Not as a separate call: the person who has just been given a driver's
-- number is about to be told "a white Alto, TR01AB1234". One round trip,
-- one rate-limit entry, one audit row. A second function would let somebody
-- harvest plates without the reveal being logged.
--
-- Adding a column to the RETURN changes the function's type, and Postgres
-- refuses that on CREATE OR REPLACE with 42P13. It must be dropped first --
-- this is the error 65 hit and the reason the drop below is explicit.
--
-- The body is 65's, copied. The only changes are the extra column in the
-- signature, the extra null in each early return, and the plate on the last
-- line. Retyping the rest from memory is how columns go missing.
-- ===========================================================================
drop function if exists public.services_reveal_contact(uuid);

create or replace function public.services_reveal_contact(p_worker_id uuid)
returns table (ok boolean, reason text, phone text, full_name text,
               address_line text, landmark text, pincode text,
               vehicle_number text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_viewer uuid := public.services_account_id();
  w        record;
  v_recent int;
begin
  if v_viewer is null then
    return query select false, 'sign_in_required'::text,
                        null::text, null::text, null::text, null::text, null::text,
                        null::text; return;
  end if;

  select count(*) into v_recent
  from public.services_contact_views v
  where v.viewer_id = v_viewer
    and v.created_at > now() - interval '1 hour';

  if v_recent >= 40 then
    return query select false, 'rate_limited'::text,
                        null::text, null::text, null::text, null::text, null::text,
                        null::text; return;
  end if;

  select * into w
  from public.services_workers
  where id = p_worker_id and status = 'approved' and available;

  if not found then
    return query select false, 'not_found'::text,
                        null::text, null::text, null::text, null::text, null::text,
                        null::text; return;
  end if;

  insert into public.services_contact_views (worker_id, viewer_id)
  values (p_worker_id, v_viewer);

  return query select true, 'ok'::text, w.phone::text, w.full_name::text,
                      w.address_line::text, w.landmark::text, w.pincode::text,
                      -- Only for a trade that drives: a plumber's private car
                      -- is nobody's business, and this way the trades that
                      -- must GIVE a plate and the trades that SHOW one can
                      -- never drift apart.
                      (select case when t.requires_vehicle then w.vehicle_number end
                         from public.services_trades t where t.slug = w.trade_slug)::text;
end;
$$;

revoke all on function public.services_reveal_contact(uuid) from public, anon, authenticated;
grant execute on function public.services_reveal_contact(uuid) to authenticated;

-- ===========================================================================
-- VERIFY
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'vehicle_column', (select count(*) from information_schema.columns
                      where table_schema='public' and table_name='services_workers'
                        and column_name='vehicle_number'),
  'vehicle_readable_by_clients', (select count(*) from information_schema.column_privileges
                                   where table_schema='public' and table_name='services_workers'
                                     and column_name='vehicle_number'
                                     and grantee in ('anon','authenticated')),
  'trade_flag_columns', (select count(*) from information_schema.columns
                          where table_schema='public' and table_name='services_trades'
                            and column_name in ('requires_vehicle','requires_id')),
  'trades_needing_vehicle', (select count(*) from public.services_trades where requires_vehicle),
  'trades_needing_id', (select count(*) from public.services_trades where requires_id),
  'update_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                        where n.nspname='public' and p.proname='services_update_my_listing'),
  'my_listing_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                            where n.nspname='public' and p.proname='services_my_listing'),
  'detail_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                        where n.nspname='public' and p.proname='services_admin_worker_detail'),
  'set_status_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                            where n.nspname='public' and p.proname='services_admin_set_status'),
  'plate_check_constraint', (select count(*) from pg_constraint
                              where conname='services_workers_plate_shape'),
  'listings_now_incomplete', (select count(*) from public.services_workers w
                               where array_length(public.services_listing_gaps(w.id), 1) > 0),
  'approved_but_incomplete', (select count(*) from public.services_workers w
                               where w.status='approved'
                                 and array_length(public.services_listing_gaps(w.id), 1) > 0),
  'expected', 'vehicle_column 1; vehicle_readable_by_clients 0; trade_flag_columns 2; every overload count 1; plate_check_constraint 1. approved_but_incomplete counts people already published who now fall short -- they STAY published; the gate only applies on the next approval.'
)) as "67_verify";
