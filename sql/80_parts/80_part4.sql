-- 80 part 4 of 4: customers ask who is available near them.

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

    execute format(
      'select to_jsonb(b) from public.services_browse_workers(
          p_trade := %L, p_locality := NULL, p_search := NULL, p_group := %L,
          p_kind := NULL, p_state := %L, p_limit := 200, p_offset := 0,
          p_lat := %L, p_lng := %L, p_radius_km := NULL) b
        where b.id = %L limit 1',
      p_trade, p_group, r.state, r.home_lat, r.home_lng, r.id)
      into v_card;

    continue when v_card is null;

    v_n := v_n + 1;
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
