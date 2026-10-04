-- 93 part 1 of 5: rate limiter and consent records.
-- Needs 66 to 92 already run. Safe to run again.

-- Fixed-window counters. Key = action + who (account, or IP when signed out).
create table if not exists public.services_rate (
  k  text        not null,
  at timestamptz not null,
  n  int         not null default 0,
  primary key (k, at)
);
alter table public.services_rate enable row level security;
revoke all on public.services_rate from public, anon, authenticated;

create or replace function public.services_client_ip()
returns text language sql stable as $fn$
  select coalesce(
    nullif(btrim(nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip'), ''),
    nullif(btrim(split_part(coalesce(
      nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'unknown');
$fn$;

create or replace function public.services_rate_hit(p_key text, p_limit int, p_window int)
returns boolean language plpgsql volatile security definer
set search_path to 'public' as $fn$
declare
  v_at timestamptz := to_timestamp(floor(extract(epoch from now()) / greatest(p_window, 1)) * greatest(p_window, 1));
  v_n  int;
begin
  insert into public.services_rate (k, at, n) values (p_key, v_at, 1)
  on conflict (k, at) do update set n = public.services_rate.n + 1
  returning n into v_n;
  if random() < 0.01 then
    delete from public.services_rate where at < now() - interval '2 days';
  end if;
  return v_n <= p_limit;
end;
$fn$;

-- Raises rate_limited (hint = the action) when the limit is passed.
create or replace function public.services_rate_guard(p_action text, p_who text, p_limit int, p_window int)
returns void language plpgsql volatile security definer
set search_path to 'public' as $fn$
begin
  if not public.services_rate_hit(p_action || ':' || coalesce(p_who, 'none'), p_limit, p_window) then
    raise exception 'rate_limited' using hint = p_action, errcode = 'PT429';
  end if;
end;
$fn$;

revoke all on function public.services_rate_hit(text, int, int) from public, anon, authenticated;
revoke all on function public.services_rate_guard(text, text, int, int) from public, anon, authenticated;

-- What each person agreed to: current answer, and a log of every change.
create table if not exists public.services_consents (
  account_id uuid not null references public.services_signups(id) on delete cascade,
  purpose    text not null check (purpose in ('location','live','account','listing','market','profile')),
  version    int  not null default 1,
  granted    boolean not null,
  at         timestamptz not null default now(),
  primary key (account_id, purpose)
);
create table if not exists public.services_consent_log (
  id         bigint generated always as identity primary key,
  account_id uuid not null references public.services_signups(id) on delete cascade,
  purpose    text not null,
  version    int  not null,
  granted    boolean not null,
  at         timestamptz not null default now()
);
alter table public.services_consents    enable row level security;
alter table public.services_consent_log enable row level security;
revoke all on public.services_consents, public.services_consent_log from public, anon, authenticated;

notify pgrst, 'reload schema';
select 'part 1 done' as "93_part1";
