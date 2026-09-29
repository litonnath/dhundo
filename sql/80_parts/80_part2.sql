-- 80 part 2 of 4: going online, sending position, going offline.

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
as $fn$
declare
  v_worker  uuid;
  v_visible boolean := false;
  v_until   timestamptz;
  v_ok      boolean := false;
  v_reason  text;
begin
  select w.id, (w.status = 'approved' and w.available)
    into v_worker, v_visible
    from public.services_workers w
   where w.user_id = public.services_account_id()
   limit 1;

  if v_worker is null then
    v_reason := 'no_listing';
  elsif not p_on then
    delete from public.services_presence where worker_id = v_worker;
    v_ok := true;
    v_reason := 'offline';
  elsif p_lat is null or p_lng is null
        or p_lat not between 5 and 38 or p_lng not between 67 and 99 then
    v_reason := 'bad_location';
  elsif p_hours is null then
    update public.services_presence pr
       set lat = p_lat, lng = p_lng, accuracy_m = p_accuracy, seen_at = now()
     where pr.worker_id = v_worker and pr.online_until > now()
    returning pr.online_until into v_until;
    if v_until is null then
      delete from public.services_presence where worker_id = v_worker;
      v_reason := 'offline';
    else
      v_ok := true;
      v_reason := 'updated';
    end if;
  else
    v_until := now() + make_interval(hours => greatest(1, least(p_hours, 12)));
    insert into public.services_presence (worker_id, lat, lng, accuracy_m, online_until, seen_at)
    values (v_worker, p_lat, p_lng, p_accuracy, v_until, now())
    on conflict (worker_id) do update
       set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m,
           online_until = excluded.online_until, seen_at = now();
    v_ok := true;
    v_reason := 'online';
  end if;

  return query select v_ok, v_reason, v_until, coalesce(v_visible, false);
end;
$fn$;

revoke all on function public.services_set_availability(boolean, double precision, double precision, real, int) from public, anon, authenticated;
grant execute on function public.services_set_availability(boolean, double precision, double precision, real, int) to authenticated;

select 'part 2 done' as result;
