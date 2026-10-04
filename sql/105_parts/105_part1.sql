-- ===========================================================================
-- 105_part1.sql -- My data screen: nominee, data request log, data export.
-- Needs 93 (services_rate_guard) and 66/68.
-- ===========================================================================
alter table public.services_signups
  add column if not exists nominee_name  text,
  add column if not exists nominee_phone text;

create table if not exists public.services_privacy_requests (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.services_signups(id) on delete cascade,
  kind       text not null check (kind in ('access', 'correct', 'erase', 'grievance', 'other')),
  body       text,
  status     text not null default 'open' check (status in ('open', 'done')),
  reply      text,
  created_at timestamptz not null default now(),
  due_at     timestamptz not null default (now() + interval '30 days'),
  closed_at  timestamptz
);
alter table public.services_privacy_requests enable row level security;
revoke all on public.services_privacy_requests from public, anon, authenticated;

create or replace function public.services_set_nominee(p_name text, p_phone text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('nominee', v_me::text, 20, 3600);
  if btrim(coalesce(p_name, '')) = '' and v_digits = '' then
    update public.services_signups set nominee_name = null, nominee_phone = null where id = v_me;
    return query select true, 'cleared'::text;
    return;
  end if;
  if btrim(coalesce(p_name, '')) = '' or length(v_digits) < 10 then
    return query select false, 'bad_input'::text;
    return;
  end if;
  update public.services_signups
     set nominee_name = left(btrim(p_name), 80), nominee_phone = right(v_digits, 10)
   where id = v_me;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_set_nominee(text, text) from public, anon, authenticated;
grant execute on function public.services_set_nominee(text, text) to authenticated;

create or replace function public.services_privacy_request(p_kind text, p_body text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('privacy_request', v_me::text, 5, 86400);
  if p_kind not in ('access', 'correct', 'erase', 'grievance', 'other') then
    return query select false, 'bad_kind'::text;
    return;
  end if;
  insert into public.services_privacy_requests (account_id, kind, body)
  values (v_me, p_kind, left(btrim(coalesce(p_body, '')), 1000));
  return query select true, 'received'::text;
end;
$fn$;
revoke all on function public.services_privacy_request(text, text) from public, anon, authenticated;
grant execute on function public.services_privacy_request(text, text) to authenticated;

-- Everything held about the signed-in person, as one document they can read
-- on screen or save as a file.
create or replace function public.services_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_out jsonb;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in_required');
  end if;
  select jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'account', (select jsonb_build_object('name', s.full_name, 'phone', s.phone,
                  'referral_code', s.referral_code, 'nominee_name', s.nominee_name,
                  'nominee_phone', s.nominee_phone)
                  from public.services_signups s where s.id = v_me),
    'listings', coalesce((select jsonb_agg(to_jsonb(w) - 'id_doc_path' - 'user_id')
                  from public.services_workers w where w.user_id = v_me), '[]'::jsonb),
    'has_id_document', exists (select 1 from public.services_workers w
                  where w.user_id = v_me and w.id_doc_path is not null),
    'wallet', coalesce((select jsonb_agg(jsonb_build_object('amount_paise', e.amount_paise,
                  'kind', e.kind, 'note', e.note, 'at', e.created_at) order by e.created_at)
                  from public.services_wallet_entries e where e.account_id = v_me), '[]'::jsonb),
    'withdrawals', coalesce((select jsonb_agg(jsonb_build_object('amount_paise', x.amount_paise,
                  'upi_id', x.upi_id, 'status', x.status, 'at', x.created_at))
                  from public.services_withdrawals x where x.account_id = v_me), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'account_id')
                  from public.services_consents c where c.account_id = v_me), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'status', r.status,
                  'at', r.created_at, 'due', r.due_at) order by r.created_at)
                  from public.services_privacy_requests r where r.account_id = v_me), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$fn$;
revoke all on function public.services_my_data() from public, anon, authenticated;
grant execute on function public.services_my_data() to authenticated;

notify pgrst, 'reload schema';
select 'part 1 of 2 done' as "105_part1";
