-- ===========================================================================
-- 80_live_availability.sql
--
-- "AVAILABLE NOW", the Rapido-captain idea for every trade.
--
-- A worker taps "I'm available now". While Dhundo is open on their phone it
-- sends their position about once a minute. Customers see them first, with
-- a green "Available now" badge and the distance from where they are NOW --
-- which matters most for anyone who moves around (autos, drivers, delivery)
-- and least for a mistri at home.
--
-- WHAT IS DELIBERATELY NOT SHOWN
-- The position itself. Customers get a distance, never a point: a live dot
-- on a public map would let anybody follow a worker around town. This keeps
-- the promise the app already makes ("only the distance is ever shown").
--
-- WHY IT GOES STALE
-- Dhundo is a web app in an Android shell, so it can read the location only
-- while it is open. A worker who locks their phone stops updating; after
-- 30 minutes without an update they drop out of "available now" rather than
-- showing customers a position that is no longer true. The switch also ends
-- by itself after the hours they chose (4 by default, 12 at most), so
-- nobody is left "available" overnight by forgetting.
--
-- HOW THE CARDS ARE BUILT
-- services_browse_workers (63, not in this repository) decides who may be
-- shown and what a card contains. Rather than duplicate it, each available
-- worker's card is fetched THROUGH it, so every rule it applies -- published,
-- not paused, which fields are public -- applies here unchanged. Only the
-- distance is replaced with the live one.
-- ===========================================================================

create table if not exists public.services_presence (
  worker_id    uuid primary key references public.services_workers(id) on delete cascade,
  lat          double precision not null,
  lng          double precision not null,
  accuracy_m   real,
  online_until timestamptz not null,
  seen_at      timestamptz not null default now()
);

create index if not exists services_presence_live
  on public.services_presence (online_until, seen_at);

-- Nobody reads or writes this table directly; only the functions below.
alter table public.services_presence enable row level security;
revoke all on public.services_presence from public, anon, authenticated;

-- How long without an update before "available" stops being true.
create or replace function public.services_presence_fresh_minutes()
returns int language sql immutable as $$ select 30 $$;

create or replace function public.services_km(
  a_lat double precision, a_lng double precision,
  b_lat double precision, b_lng double precision)
returns double precision
language sql immutable
as $$
  select 6371.0 * 2 * asin(sqrt(
           power(sin(radians(b_lat - a_lat) / 2), 2) +
           cos(radians(a_lat)) * cos(radians(b_lat)) *
           power(sin(radians(b_lng - a_lng) / 2), 2)));
$$;

-- ===========================================================================
-- THE WORKER'S SIDE
--
-- p_on = true,  p_hours given  -> go online for that many hours (1-12)
-- p_on = true,  p_hours null   -> a heartbeat: new position, same end time.
--                                 Refused with 'offline' once the switch
--                                 has run out, so the phone learns it.
-- p_on = false                 -> go offline now.
-- ===========================================================================
drop function if exists public.services_set_availability(boolean, double precision, double precision, real, int);

create or replace function public.services_set_availability(
  p_on       boolean,
  p_lat      double precision default null,
  p_lng      double precision default null,
  p_accuracy real             default null,
  p_hours    int              default null
)
returns table (ok boolean, reason text, online_until timestamptz, visible boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_worker  uuid;
  v_visible boolean;
  v_until   timestamptz;
begin
  select w.id, (w.status = 'approved' and w.available)
    into v_worker, v_visible
    from public.services_workers w
   where w.user_id = public.services_account_id()
   limit 1;

  if v_worker is null then
    return query select false, 'no_listing'::text, null::timestamptz, false; return;
  end if;

  if not p_on then
    delete from public.services_presence where worker_id = v_worker;
    return query select true, 'offline'::text, null::timestamptz, v_visible; return;
  end if;

  -- Roughly India, generously: a position outside this is a bad fix or a
  -- spoofed one, and would put the worker on nobody's list anyway.
  if p_lat is null or p_lng is null
     or p_lat not between 5 and 38 or p_lng not between 67 and 99 then
    return query select false, 'bad_location'::text, null::timestamptz, v_visible; return;
  end if;

  if p_hours is null then
    update public.services_presence pr
       set lat = p_lat, lng = p_lng, accuracy_m = p_accuracy, seen_at = now()
     where pr.worker_id = v_worker and pr.online_until > now()
    returning pr.online_until into v_until;
    if v_until is null then
      delete from public.services_presence where worker_id = v_worker;
      return query select false, 'offline'::text, null::timestamptz, v_visible; return;
    end if;
    return query select true, 'updated'::text, v_until, v_visible; return;
  end if;

  v_until := now() + make_interval(hours => greatest(1, least(p_hours, 12)));
  insert into public.services_presence (worker_id, lat, lng, accuracy_m, online_until, seen_at)
  values (v_worker, p_lat, p_lng, p_accuracy, v_until, now())
  on conflict (worker_id) do update
     set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m,
         online_until = excluded.online_until, seen_at = now();

  return query select true, 'online'::text, v_until, v_visible;
end;
$$;

revoke all on function public.services_set_availability(boolean, double precision, double precision, real, int) from public, anon, authenticated;
grant execute on function public.services_set_availability(boolean, double precision, double precision, real, int) to authenticated;

drop function if exists public.services_my_availability();

create or replace function public.services_my_availability()
returns table (online boolean, online_until timestamptz, seen_at timestamptz, visible boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select (pr.worker_id is not null and pr.online_until > now()),
         pr.online_until, pr.seen_at,
         (w.status = 'approved' and w.available)
    from public.services_workers w
    left join public.services_presence pr on pr.worker_id = w.id
   where w.user_id = public.services_account_id()
   limit 1;
$$;

revoke all on function public.services_my_availability() from public, anon, authenticated;
grant execute on function public.services_my_availability() to authenticated;

-- ===========================================================================
-- THE CUSTOMER'S SIDE
--
-- Workers who are available now, nearest first by where they are NOW.
-- With the viewer's coordinates: within p_radius_km of them. Without: the
-- whole state, most recently seen first.
--
-- Returns the same card JSON as services_browse_workers, with distance_km
-- replaced by the live distance and three fields added: available_now,
-- live_seen_at, live_until.
-- ===========================================================================
drop function if exists public.services_available_workers(double precision, double precision, text, text, text, double precision, int);

create or replace function public.services_available_workers(
  p_lat       double precision default null,
  p_lng       double precision default null,
  p_state     text             default null,
  p_trade     text             default null,
  p_group     text             default null,
  p_radius_km double precision default 15,
  p_limit     int              default 20
)
returns setof jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  r      record;
  v_card jsonb;
  v_rad  double precision := greatest(1, least(coalesce(p_radius_km, 15), 100));
  v_deg  double precision;
  v_n    int := 0;
begin
  v_deg := v_rad / 111.0;   -- a cheap bounding box before the exact distance

  for r in
    select w.id, w.state, w.lat as home_lat, w.lng as home_lng,
           pr.seen_at, pr.online_until,
           case when p_lat is null or p_lng is null then null
                else public.services_km(p_lat, p_lng, pr.lat, pr.lng) end as km
      from public.services_presence pr
      join public.services_workers w on w.id = pr.worker_id
     where pr.online_until > now()
       and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
       and w.status = 'approved' and w.available
       and (p_state is null or p_lat is not null or w.state = p_state)
       and (p_lat is null or p_lng is null
            or (pr.lat between p_lat - v_deg and p_lat + v_deg
                and pr.lng between p_lng - v_deg / greatest(cos(radians(p_lat)), 0.2)
                               and p_lng + v_deg / greatest(cos(radians(p_lat)), 0.2)))
     order by km nulls last, pr.seen_at desc
     limit 200
  loop
    exit when v_n >= greatest(1, least(coalesce(p_limit, 20), 50));
    continue when r.km is not null and r.km > v_rad;

    -- The card, through the ordinary search, centred on the worker's own
    -- listed location so they are certainly within its page. Literals
    -- (%L) rather than typed variables, so this matches whatever parameter
    -- types 63 declared.
    execute format(
      'select to_jsonb(b) from public.services_browse_workers(
          p_trade := %L, p_locality := NULL, p_search := NULL, p_group := %L,
          p_kind := NULL, p_state := %L, p_limit := 200, p_offset := 0,
          p_lat := %L, p_lng := %L, p_radius_km := NULL) b
        where b.id = %L limit 1',
      p_trade, p_group, r.state, r.home_lat, r.home_lng, r.id)
      into v_card;

    -- Not returned by the search: filtered out by trade or group, or
    -- hidden by one of its rules. Either way, not ours to show.
    continue when v_card is null;

    v_n := v_n + 1;
    -- total_count describes the search page the card came from, not this
    -- list. Without the viewer's position there is no distance to give:
    -- the search's own figure would be from the worker's home to itself.
    return next (v_card - 'total_count') || jsonb_build_object(
      'distance_km',   case when r.km is null then null
                            else to_jsonb(round(r.km::numeric, 1)) end,
      'available_now', true,
      'live_seen_at',  r.seen_at,
      'live_until',    r.online_until);
  end loop;
end;
$$;

revoke all on function public.services_available_workers(double precision, double precision, text, text, text, double precision, int) from public;
grant execute on function public.services_available_workers(double precision, double precision, text, text, text, double precision, int) to anon, authenticated;

-- ===========================================================================
-- VERIFY
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'presence_table', (to_regclass('public.services_presence') is not null),
  'functions', (select count(*) from pg_proc
                 where pronamespace = 'public'::regnamespace
                   and proname in ('services_set_availability', 'services_my_availability',
                                   'services_available_workers')),
  'search_function_found', (to_regproc('public.services_browse_workers') is not null
                            or exists (select 1 from pg_proc where proname = 'services_browse_workers')),
  'expected', 'presence_table true; functions 3; search_function_found true'
)) as "80_verify";
