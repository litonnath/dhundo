-- 155_part1.sql -- working days, working hours and how far a worker travels.
create table if not exists public.services_biz_schedule (
  account_id uuid primary key references public.services_signups(id) on delete cascade,
  days       int  not null default 127 check (days between 0 and 127),
  all_day    boolean not null default true,
  from_time  time,
  to_time    time,
  radius_km  int check (radius_km is null or radius_km between 1 and 300),
  updated_at timestamptz not null default now()
);
alter table public.services_biz_schedule enable row level security;
revoke all on public.services_biz_schedule from public, anon, authenticated;

drop function if exists public.services_schedule_get();
create function public.services_schedule_get()
returns table (days int, all_day boolean, from_time text, to_time text, radius_km int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select coalesce(s.days, 127), coalesce(s.all_day, true), to_char(s.from_time, 'HH24:MI'), to_char(s.to_time, 'HH24:MI'), s.radius_km
    from (select 1) x
    left join public.services_biz_schedule s on s.account_id = public.services_account_id();
$fn$;
revoke all on function public.services_schedule_get() from public, anon, authenticated;
grant execute on function public.services_schedule_get() to authenticated;

drop function if exists public.services_schedule_save(int, boolean, text, text, int);
create function public.services_schedule_save(p_days int, p_all_day boolean, p_from text, p_to text, p_radius int)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare v_acc uuid := public.services_account_id();
begin
  if v_acc is null then return query select false, 'signin'; return; end if;
  if not exists (select 1 from public.services_workers w where w.user_id = v_acc) then
    return query select false, 'no_listing'; return;
  end if;
  insert into public.services_biz_schedule (account_id, days, all_day, from_time, to_time, radius_km, updated_at)
  values (v_acc, greatest(0, least(coalesce(p_days, 127), 127)), coalesce(p_all_day, true),
          case when coalesce(p_all_day, true) then null else nullif(p_from, '')::time end,
          case when coalesce(p_all_day, true) then null else nullif(p_to, '')::time end,
          nullif(p_radius, 0), now())
  on conflict (account_id) do update
     set days = excluded.days, all_day = excluded.all_day, from_time = excluded.from_time,
         to_time = excluded.to_time, radius_km = excluded.radius_km, updated_at = now();
  return query select true, 'saved';
exception when others then
  return query select false, 'bad_time';
end;
$fn$;
revoke all on function public.services_schedule_save(int, boolean, text, text, int) from public, anon, authenticated;
grant execute on function public.services_schedule_save(int, boolean, text, text, int) to authenticated;

drop function if exists public.services_schedule_public(uuid);
create function public.services_schedule_public(p_worker uuid)
returns table (days int, all_day boolean, from_time text, to_time text, radius_km int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select s.days, s.all_day, to_char(s.from_time, 'HH24:MI'), to_char(s.to_time, 'HH24:MI'), s.radius_km
    from public.services_workers w
    join public.services_biz_schedule s on s.account_id = w.user_id
   where w.id = p_worker and w.status = 'approved';
$fn$;
revoke all on function public.services_schedule_public(uuid) from public;
grant execute on function public.services_schedule_public(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
select 'part 1 done' as "155_part1";
