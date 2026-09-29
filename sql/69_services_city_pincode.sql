-- ===========================================================================
-- 69_services_city_pincode.sql
--
-- Address becomes three things instead of one free-text guess:
--
--   1. CITY      -- chosen from a list (Panisagar, Dharmanagar, ...).
--                   Carries the district and a coordinate with it.
--   2. AREA      -- typed, exactly as the person says it. Their para, their
--                   spelling, whether or not any register has heard of it.
--   3. PINCODE   -- optional, and a second source of both district and
--                   coordinates for places the city list does not cover well.
--
-- ---------------------------------------------------------------------------
-- WHY THIS SHAPE
-- ---------------------------------------------------------------------------
-- The previous design asked for one "area" and tried to make it do three
-- jobs: name the place, identify the district, and produce a coordinate. It
-- could not. A typed para is not in any register, so it yielded no district
-- and no coordinate; and when the app tried to supply them by looking up the
-- nearest listed village, it renamed people to villages they do not live in.
--
-- Splitting them fixes each one with the source that can actually answer it:
--
--   * A district is an administrative fact. It follows from the city, which
--     comes from a list, so it is never typed and never wrong.
--   * A coordinate needs a register or a GPS fix. The city gives a town-level
--     one (good to a few kilometres -- enough to sort by distance), the
--     pincode gives a similar one, and the worker's own phone gives a precise
--     one that beats both.
--   * The para name needs nobody's permission. It is whatever they typed.
--
-- So a listing can now say "Tilthai, Panisagar, North Tripura" where before
-- it could only say "Champaknagar" and be wrong.
--
-- ---------------------------------------------------------------------------
-- WHERE COORDINATES COME FROM, IN ORDER
-- ---------------------------------------------------------------------------
--   1. loc_source = 'device'  -- the worker's own GPS fix. Never overwritten.
--   2. loc_source = 'pin'     -- from services_pincodes.
--   3. loc_source = 'city'    -- the centre of the chosen city.
--   4. loc_source = 'area'    -- 63's behaviour, kept for rows that predate
--                                this file and for an area that happens to
--                                be a known place.
--
-- Each is a fallback for the one above, and each records WHICH it was, so
-- "4 km away" derived from a town centre is distinguishable from one derived
-- from a GPS fix. Nothing in the app yet treats them differently; the column
-- exists so it can.
-- ===========================================================================

do $$
begin
  if to_regclass('public.services_regions') is null
     or to_regclass('public.services_workers') is null then
    raise exception 'Run 55 through 68 first.';
  end if;
end $$;

-- ===========================================================================
-- PINCODES
--
-- A lookup table, not an API call. There is a free pincode API in India
-- (postalpincode.in, no key) but it returns the post office, district and
-- state and NO coordinates -- which is the half we cannot compute ourselves.
-- GeoNames' postal export does carry latitude and longitude, so that is what
-- import_pincodes.py loads in here, once, offline.
--
-- A table also means no per-listing network call, no rate limit, and no
-- dependency that can be down at the moment somebody is signing up on a
-- 3G connection in a village.
-- ===========================================================================
create table if not exists public.services_pincodes (
  pincode   text primary key check (pincode ~ '^[1-9][0-9]{5}$'),
  place     text,
  district  text,
  state     text,
  lat       double precision,
  lng       double precision,
  source    text not null default 'geonames',
  loaded_at timestamptz not null default now()
);

create index if not exists services_pincodes_state_idx
  on public.services_pincodes (state);

alter table public.services_pincodes enable row level security;
revoke all on public.services_pincodes from public, anon, authenticated;

-- Readable by anyone through the function below, not directly: a bulk dump
-- of the table is of no use to the app and every use to somebody scraping.
drop function if exists public.services_pincode_lookup(text);

create or replace function public.services_pincode_lookup(p_pin text)
returns table (pincode text, place text, district text, state text,
               lat double precision, lng double precision)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.pincode, p.place, p.district, p.state, p.lat, p.lng
    from public.services_pincodes p
   where p.pincode = regexp_replace(coalesce(p_pin, ''), '\D', '', 'g')
   limit 1;
$$;

revoke all on function public.services_pincode_lookup(text) from public, anon, authenticated;
grant execute on function public.services_pincode_lookup(text) to anon, authenticated;

-- Bulk loader, service_role only -- same pattern as 62's region loader.
create or replace function public.services_load_pincodes(p_rows jsonb)
returns table (inserted int, updated int)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_before int;
  v_total  int;
begin
  select count(*) into v_before from public.services_pincodes;

  insert into public.services_pincodes (pincode, place, district, state, lat, lng, source)
  select
    regexp_replace(r->>'pincode', '\D', '', 'g'),
    nullif(btrim(coalesce(r->>'place', '')), ''),
    nullif(btrim(coalesce(r->>'district', '')), ''),
    nullif(btrim(coalesce(r->>'state', '')), ''),
    nullif(r->>'lat', '')::double precision,
    nullif(r->>'lng', '')::double precision,
    coalesce(nullif(btrim(coalesce(r->>'source', '')), ''), 'geonames')
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  where regexp_replace(coalesce(r->>'pincode', ''), '\D', '', 'g') ~ '^[1-9][0-9]{5}$'
  on conflict (pincode) do update set
    place    = coalesce(excluded.place, public.services_pincodes.place),
    district = coalesce(excluded.district, public.services_pincodes.district),
    state    = coalesce(excluded.state, public.services_pincodes.state),
    -- Never replace a known coordinate with a null one.
    lat      = coalesce(excluded.lat, public.services_pincodes.lat),
    lng      = coalesce(excluded.lng, public.services_pincodes.lng),
    source   = excluded.source,
    loaded_at = now();

  get diagnostics v_total = row_count;
  return query select
    (select count(*)::int from public.services_pincodes) - v_before,
    v_total - ((select count(*)::int from public.services_pincodes) - v_before);
end;
$$;

revoke all on function public.services_load_pincodes(jsonb) from public, anon, authenticated;

-- ===========================================================================
-- WHICH REGION ROWS ARE SELECTABLE AS A CITY
--
-- Not every row in services_regions belongs in a dropdown -- it holds
-- villages and paras too, thousands of them once the OSM import runs, and a
-- list that long is not a choice, it is a search problem. A city is the level
-- somebody recognises and can pick: a town, a subdivision headquarters, a
-- municipal area.
-- ===========================================================================
alter table public.services_regions
  add column if not exists is_city boolean not null default false;

-- Seeded from kind, once. Guarded so that a row promoted or demoted by hand
-- later is not undone by a re-run.
alter table public.services_regions
  add column if not exists city_seeded boolean not null default false;

update public.services_regions
   set is_city = (kind in ('city', 'town')),
       city_seeded = true
 where city_seeded = false;

create index if not exists services_regions_city_idx
  on public.services_regions (state, place)
  where is_city and active;

-- The dropdown's source.
drop function if exists public.services_cities(text, text, int);

create or replace function public.services_cities(
  p_state text,
  p_q     text default null,
  p_limit int default 200
)
returns table (id bigint, place text, district text, block text,
               lat double precision, lng double precision)
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.id, r.place::text, r.district::text, r.block::text, r.lat, r.lng
    from public.services_regions r
   where r.active and r.is_city
     and (p_state is null or r.state = p_state)
     and (
       p_q is null or btrim(p_q) = ''
       or r.search_key like '%' || lower(regexp_replace(p_q, '[^a-zA-Z0-9]+', ' ', 'g')) || '%'
     )
   order by
     -- A city whose name STARTS with what was typed comes first: typing
     -- "dha" should offer Dharmanagar before Uttar Dhalai.
     case when r.search_key like lower(regexp_replace(coalesce(p_q, ''), '[^a-zA-Z0-9]+', ' ', 'g')) || '%'
          then 0 else 1 end,
     r.place
   limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

revoke all on function public.services_cities(text, text, int) from public, anon, authenticated;
grant execute on function public.services_cities(text, text, int) to anon, authenticated;

-- ===========================================================================
-- THE LISTING GAINS A CITY AND A DISTRICT
--
-- `city` already existed as free text and was mostly null. It now holds the
-- chosen city's NAME (so nothing that reads it has to join), while city_id
-- holds the reference that district and coordinates are derived from.
-- ===========================================================================
alter table public.services_workers
  add column if not exists city_id  bigint references public.services_regions(id) on delete set null,
  add column if not exists district text;

create index if not exists services_workers_city_idx
  on public.services_workers (city_id) where city_id is not null;

-- Readable: a district and a city are what a person reads on a card. The
-- exact address and the coordinates stay out of the grants, as before.
grant select (city_id, district) on public.services_workers to anon, authenticated;

-- ===========================================================================
-- FILLING IN WHAT FOLLOWS FROM THE CHOICE
--
-- Replaces 63's trigger function. Same name and same trigger, so no new
-- trigger is created; the body gains the city and pincode sources and keeps
-- 63's area lookup as the last resort.
-- ===========================================================================
create or replace function public.services_fill_area_coords()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  -- Scalars, not a record. A record is only "assigned" if its SELECT found a
  -- row, and reading a field of an unassigned record raises
  -- "record c is not assigned yet" -- which is what happened here the first
  -- time, for any listing whose city_id was null. Scalars are simply null.
  v_city_place text;
  v_city_lat   double precision;
  v_city_lng   double precision;
  v_pin_dist   text;
  v_pin_lat    double precision;
  v_pin_lng    double precision;
  v_area_lat   double precision;
  v_area_lng   double precision;
  v_state      text;
begin
  -- THE CITY decides the district and the city name, always -- even when a
  -- device fix means we will not take its coordinates. These are
  -- administrative facts about the chosen place, not a guess about where the
  -- person is standing.
  if new.city_id is not null then
    select r.place, r.district, r.state, r.lat, r.lng
      into v_city_place, new.district, v_state, v_city_lat, v_city_lng
      from public.services_regions r where r.id = new.city_id;
    if v_city_place is not null then
      new.city := v_city_place;
      -- A city in the wrong state would be a listing filed under a state its
      -- city is not in, which is the bug 63's header warns about.
      if v_state is not null then new.state := v_state; end if;
    end if;
  end if;

  -- A device fix beats everything below it and is never overwritten.
  if new.loc_source = 'device' and new.lat is not null then
    return new;
  end if;

  -- PINCODE next: it is narrower than a whole town.
  if new.pincode is not null and btrim(new.pincode) <> '' then
    select pc.district, pc.lat, pc.lng
      into v_pin_dist, v_pin_lat, v_pin_lng
      from public.services_pincodes pc
     where pc.pincode = regexp_replace(new.pincode, '\D', '', 'g');
    if new.district is null then new.district := v_pin_dist; end if;
    if v_pin_lat is not null then
      new.lat := v_pin_lat; new.lng := v_pin_lng; new.loc_source := 'pin';
      return new;
    end if;
  end if;

  -- CITY centre.
  if v_city_lat is not null then
    new.lat := v_city_lat; new.lng := v_city_lng; new.loc_source := 'city';
    return new;
  end if;

  -- 63's behaviour, last: the typed area, if it happens to be a known place.
  -- Kept so rows written before this file still behave as they did.
  if new.locality is not null and btrim(new.locality) <> '' then
    select r.lat, r.lng into v_area_lat, v_area_lng
      from public.services_regions r
     where r.state = new.state
       and lower(r.place) = lower(btrim(new.locality))
       and r.lat is not null
     limit 1;
    if v_area_lat is not null then
      new.lat := v_area_lat; new.lng := v_area_lng; new.loc_source := 'area';
    end if;
  end if;

  return new;
end;
$$;

-- The trigger fired only on locality/state/lat/lng. A changed city or
-- pincode has to fire it too, or choosing a city would change nothing until
-- the next unrelated edit.
drop trigger if exists services_workers_fill_coords on public.services_workers;
create trigger services_workers_fill_coords
  before insert or update of locality, state, lat, lng, city_id, pincode
  on public.services_workers
  for each row execute function public.services_fill_area_coords();

-- ===========================================================================
-- SAVING A CITY
--
-- One more parameter, so one more DROP: a different argument list is a
-- different function, and two of them make PostgREST refuse the call as
-- ambiguous. Body copied from 67, not retyped.
-- ===========================================================================
drop function if exists public.services_update_my_listing(text, text, text, text, text[], int, int, int, text, text, text, text, text[], boolean, text, text, text, text, text, boolean, text);
drop function if exists public.services_update_my_listing(text, text, text, text, text[], int, int, int, text, text, text, text, text[], boolean, text, text, text, text, text, boolean, text, bigint);

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
  p_vehicle_number   text    default null,
  p_city_id          bigint  default null
)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id       bigint;
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

  -- A city that is not a city, or not in this state, is a client sending
  -- something the dropdown never offered.
  if p_city_id is not null and p_city_id > 0
     and not exists (
       select 1 from public.services_regions r
        where r.id = p_city_id and r.active and r.is_city
     ) then
    return query select false, 'bad_city'::text; return;
  end if;

  if p_phone is not null
     and regexp_replace(p_phone, '\D', '', 'g') <> regexp_replace(coalesce(v_row.phone, ''), '\D', '', 'g') then
    v_reverify := true;
  end if;

  if p_vehicle_number is not null then
    if btrim(p_vehicle_number) = '' then
      v_plate := null;
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
    vehicle_number   = case when p_vehicle_number is null then vehicle_number
                            else v_plate end,
    -- 0 is how the client says "clear it"; null still means "leave alone".
    city_id          = case when p_city_id is null then city_id
                            when p_city_id = 0 then null
                            else p_city_id end,
    verified         = case when v_reverify then false else verified end,
    status           = case when v_reverify and status = 'approved' then 'pending' else status end,
    updated_at       = now()
  where id = v_row.id;

  return query select true, (case when v_reverify then 'saved_reverify' else 'saved' end)::text;
end;
$$;

revoke all on function public.services_update_my_listing(text, text, text, text, text[], int, int, int, text, text, text, text, text[], boolean, text, text, text, text, text, boolean, text, bigint) from public, anon, authenticated;
grant execute on function public.services_update_my_listing(text, text, text, text, text[], int, int, int, text, text, text, text, text[], boolean, text, text, text, text, text, boolean, text, bigint) to authenticated;

-- ===========================================================================
-- AND THE WORKER'S OWN VIEW SHOWS IT BACK
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
  city_id bigint, district text, loc_source text
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
    w.city_id, w.district::text, w.loc_source::text
  from public.services_workers w
  join public.services_trades t on t.slug = w.trade_slug
  where w.user_id = public.services_account_id();
$$;

revoke all on function public.services_my_listing() from public, anon, authenticated;
grant execute on function public.services_my_listing() to authenticated;

-- ===========================================================================
-- RE-FILE EXISTING LISTINGS
--
-- Fires the trigger on every row so anything that can now be derived is.
-- A device fix is left alone by the function itself.
-- ===========================================================================
update public.services_workers set locality = locality;

-- ===========================================================================
-- VERIFY
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'pincode_table', (to_regclass('public.services_pincodes') is not null),
  'pincodes_loaded', (select count(*) from public.services_pincodes),
  'pincodes_with_coords', (select count(*) from public.services_pincodes where lat is not null),
  'worker_columns', (select count(*) from information_schema.columns
                      where table_schema='public' and table_name='services_workers'
                        and column_name in ('city_id','district')),
  'is_city_column', (select count(*) from information_schema.columns
                      where table_schema='public' and table_name='services_regions'
                        and column_name='is_city'),
  'cities_available', (select count(*) from public.services_regions where is_city and active),
  'cities_with_coords', (select count(*) from public.services_regions
                          where is_city and active and lat is not null),
  'trigger_columns', (select count(*) from pg_attribute a
                       join unnest((select tgattr from pg_trigger
                                     where tgrelid='public.services_workers'::regclass
                                       and tgname='services_workers_fill_coords')) x(attnum)
                         on a.attnum = x.attnum
                      where a.attrelid = 'public.services_workers'::regclass),
  'update_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                        where n.nspname='public' and p.proname='services_update_my_listing'),
  'my_listing_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                            where n.nspname='public' and p.proname='services_my_listing'),
  'cities_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                        where n.nspname='public' and p.proname='services_cities'),
  'workers_by_loc_source', (select jsonb_object_agg(coalesce(loc_source,'none'), n)
                             from (select loc_source, count(*) n
                                     from public.services_workers group by 1) s),
  'expected', 'pincode_table true; worker_columns 2; is_city_column 1; trigger_columns 6; every overload count 1. cities_available will be 0 until places are marked is_city -- see the note below. pincodes_loaded 0 until import_pincodes.py runs.'
)) as "69_verify";

-- ---------------------------------------------------------------------------
-- IF cities_available IS 0
--
-- Nothing is broken: the seed marked rows whose `kind` was already 'city' or
-- 'town', and 62's 51 seed places are all 'village' by default. Promote the
-- ones people would recognise, for example:
--
--   update public.services_regions set is_city = true
--    where state = 'Tripura'
--      and place in ('Agartala','Udaipur','Dharmanagar','Kailashahar',
--                    'Belonia','Panisagar','Ambassa','Khowai','Sabroom',
--                    'Sonamura','Teliamura','Kumarghat','Bishalgarh',
--                    'Melaghar','Amarpur','Kamalpur','Santirbazar');
--
-- Check what you have first:
--   select place, district, kind, lat is not null as has_coords
--     from public.services_regions where state='Tripura' order by place;
-- ---------------------------------------------------------------------------
