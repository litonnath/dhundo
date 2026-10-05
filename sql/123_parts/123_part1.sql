-- ===========================================================================
-- 123_part1.sql -- pay scale. A worker or driver lists the rates they work
-- for (per hour, per day, per trip and so on) and the customer picks one
-- instead of typing a price. At most 8 rates each. Needs 93 rate guard.
-- ===========================================================================
create table if not exists public.services_rates (
  id          uuid primary key default gen_random_uuid(),
  worker_id   uuid not null references public.services_workers(id) on delete cascade,
  label       text not null check (char_length(label) between 2 and 40),
  unit        text not null check (unit in ('hour', 'day', 'week', 'month', 'trip', 'km', 'job')),
  rupees      int  not null check (rupees between 1 and 1000000),
  created_at  timestamptz not null default now()
);
create index if not exists services_rates_worker_idx on public.services_rates (worker_id);
alter table public.services_rates enable row level security;
revoke all on public.services_rates from public, anon, authenticated;

drop function if exists public.services_rates_get(uuid);
create function public.services_rates_get(p_worker uuid)
returns table (id uuid, label text, unit text, rupees int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.id, r.label, r.unit, r.rupees
    from public.services_rates r
    join public.services_workers w on w.id = r.worker_id
   where r.worker_id = p_worker and w.status = 'approved'
   order by r.rupees;
$fn$;
revoke all on function public.services_rates_get(uuid) from public;
grant execute on function public.services_rates_get(uuid) to anon, authenticated;

drop function if exists public.services_my_rates();
create function public.services_my_rates()
returns table (id uuid, label text, unit text, rupees int)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select r.id, r.label, r.unit, r.rupees
    from public.services_rates r
    join public.services_workers w on w.id = r.worker_id
   where w.user_id = public.services_account_id()
   order by r.rupees;
$fn$;
revoke all on function public.services_my_rates() from public, anon, authenticated;
grant execute on function public.services_my_rates() to authenticated;

drop function if exists public.services_rate_save(uuid, text, text, int);
create function public.services_rate_save(p_id uuid, p_label text, p_unit text, p_rupees int)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_work uuid;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('rate_save', v_me::text, 100, 86400);
  select w.id into v_work from public.services_workers w
   where w.user_id = v_me and w.status in ('approved', 'pending') limit 1;
  if v_work is null then
    return query select false, 'no_listing'::text;
    return;
  end if;
  if length(btrim(coalesce(p_label, ''))) < 2 or coalesce(p_rupees, 0) < 1
     or p_unit not in ('hour', 'day', 'week', 'month', 'trip', 'km', 'job') then
    return query select false, 'bad_input'::text;
    return;
  end if;
  if p_id is null then
    if (select count(*) from public.services_rates where worker_id = v_work) >= 8 then
      return query select false, 'too_many'::text;
      return;
    end if;
    insert into public.services_rates (worker_id, label, unit, rupees)
    values (v_work, left(btrim(p_label), 40), p_unit, least(p_rupees, 1000000));
  else
    update public.services_rates r
       set label = left(btrim(p_label), 40), unit = p_unit, rupees = least(p_rupees, 1000000)
     where r.id = p_id and r.worker_id = v_work;
  end if;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_rate_save(uuid, text, text, int) from public, anon, authenticated;
grant execute on function public.services_rate_save(uuid, text, text, int) to authenticated;

drop function if exists public.services_rate_delete(uuid);
create function public.services_rate_delete(p_id uuid)
returns table (ok boolean)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_n int;
begin
  delete from public.services_rates r
   using public.services_workers w
   where r.id = p_id and w.id = r.worker_id and w.user_id = public.services_account_id();
  get diagnostics v_n = row_count;
  return query select v_n > 0;
end;
$fn$;
revoke all on function public.services_rate_delete(uuid) from public, anon, authenticated;
grant execute on function public.services_rate_delete(uuid) to authenticated;

notify pgrst, 'reload schema';
select 'part 1 of 1 done' as "123_part1";
