-- ===========================================================================
-- 113_part1.sql -- DELIVERY JOBS. A shop or restaurant posts a job (take this
-- to that address); riders who are online nearby see it and the first to
-- accept gets it. Money is agreed between them: the app takes no part.
-- Needs 80 (presence, services_km), 93 (services_rate_guard), 110_part1.
-- ===========================================================================
create table if not exists public.services_jobs (
  id           uuid primary key default gen_random_uuid(),
  poster_id    uuid not null references public.services_signups(id) on delete cascade,
  poster_work  uuid not null references public.services_workers(id) on delete cascade,
  note         text not null check (char_length(note) between 3 and 300),
  drop_text    text not null check (char_length(drop_text) between 3 and 200),
  fee_paise    int check (fee_paise is null or fee_paise between 0 and 500000),
  status       text not null default 'open'
               check (status in ('open', 'accepted', 'picked_up', 'delivered', 'cancelled', 'expired')),
  rider_work   uuid references public.services_workers(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 minutes'),
  accepted_at  timestamptz,
  done_at      timestamptz
);
create index if not exists services_jobs_open_idx on public.services_jobs (status, expires_at);
create index if not exists services_jobs_poster_idx on public.services_jobs (poster_id, created_at desc);
alter table public.services_jobs enable row level security;
revoke all on public.services_jobs from public, anon, authenticated;

create or replace function public.services_job_post(p_note text, p_drop text, p_fee_rupees int default null)
returns table (ok boolean, reason text, job_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_work uuid;
  v_id uuid;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text, null::uuid;
    return;
  end if;
  perform public.services_rate_guard('job_post', v_me::text, 20, 86400);
  select w.id into v_work from public.services_workers w
   where w.user_id = v_me and w.status = 'approved' limit 1;
  if v_work is null then
    return query select false, 'no_listing'::text, null::uuid;
    return;
  end if;
  if length(btrim(coalesce(p_note, ''))) < 3 or length(btrim(coalesce(p_drop, ''))) < 3 then
    return query select false, 'bad_input'::text, null::uuid;
    return;
  end if;
  insert into public.services_jobs (poster_id, poster_work, note, drop_text, fee_paise)
  values (v_me, v_work, left(btrim(p_note), 300), left(btrim(p_drop), 200),
          case when p_fee_rupees is null then null else least(greatest(p_fee_rupees, 0), 5000) * 100 end)
  returning id into v_id;
  return query select true, 'posted'::text, v_id;
end;
$fn$;
revoke all on function public.services_job_post(text, text, int) from public, anon, authenticated;
grant execute on function public.services_job_post(text, text, int) to authenticated;

select 'part 1 of 3 done' as "113_part1";
