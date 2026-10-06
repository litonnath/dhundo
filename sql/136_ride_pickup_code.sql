-- 136: a four digit code for each accepted ride. The passenger sees it and
-- tells the driver at pickup; the driver types it in to start the ride. That
-- shows the driver has met the right person. A ride can only be finished after
-- it was started this way. Replaces the update function from 115 part 6.
alter table public.services_rides add column if not exists pickup_code text;
alter table public.services_rides add column if not exists started_at timestamptz;

create or replace function public.services_trg_ride_code()
returns trigger
language plpgsql
as $fn$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.pickup_code := lpad((floor(random() * 10000))::int::text, 4, '0');
    new.started_at := null;
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_ride_code_trg on public.services_rides;
create trigger services_ride_code_trg before update on public.services_rides
  for each row execute function public.services_trg_ride_code();

create or replace function public.services_ride_code(p_ride uuid)
returns table (code text, started boolean, is_driver boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select case when r.passenger_id = public.services_account_id() then r.pickup_code else null end,
         r.started_at is not null,
         r.passenger_id <> public.services_account_id()
    from public.services_rides r
    left join public.services_workers w on w.id = r.driver_work
   where r.id = p_ride and r.status = 'accepted'
     and (r.passenger_id = public.services_account_id() or w.user_id = public.services_account_id());
$fn$;
revoke all on function public.services_ride_code(uuid) from public, anon, authenticated;
grant execute on function public.services_ride_code(uuid) to authenticated;

create or replace function public.services_ride_verify(p_ride uuid, p_code text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_n int := 0;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('ridecode', p_ride::text || v_me::text, 8, 3600);
  update public.services_rides r set started_at = now()
   where r.id = p_ride and r.status = 'accepted' and r.started_at is null
     and r.pickup_code = btrim(coalesce(p_code, ''))
     and exists (select 1 from public.services_workers w
                  where w.id = r.driver_work and w.user_id = v_me);
  get diagnostics v_n = row_count;
  return query select v_n > 0, case when v_n > 0 then 'ok' else 'wrong_code' end::text;
end;
$fn$;
revoke all on function public.services_ride_verify(uuid, text) from public, anon, authenticated;
grant execute on function public.services_ride_verify(uuid, text) to authenticated;

create or replace function public.services_ride_update(p_ride uuid, p_action text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_n int := 0;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  if p_action = 'cancel' then
    update public.services_rides set status = 'cancelled', done_at = now()
     where id = p_ride and passenger_id = v_me and status in ('open', 'accepted');
    get diagnostics v_n = row_count;
  elsif p_action = 'done' then
    update public.services_rides r set status = 'done', done_at = now()
     where r.id = p_ride and r.status = 'accepted' and r.started_at is not null
       and exists (select 1 from public.services_workers w
                    where w.id = r.driver_work and w.user_id = v_me);
    get diagnostics v_n = row_count;
  elsif p_action = 'release' then
    update public.services_rides r set status = 'open', driver_work = null, accepted_at = null,
           started_at = null, pickup_code = null
     where r.id = p_ride and r.status = 'accepted' and r.started_at is null and r.expires_at > now()
       and exists (select 1 from public.services_workers w
                    where w.id = r.driver_work and w.user_id = v_me);
    get diagnostics v_n = row_count;
  end if;
  return query select v_n > 0, case when v_n > 0 then 'ok' else 'no_change' end::text;
end;
$fn$;
revoke all on function public.services_ride_update(uuid, text) from public, anon, authenticated;
grant execute on function public.services_ride_update(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select 'done' as "136";
