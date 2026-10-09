-- 155_part2.sql -- vehicle documents with expiry dates (licence, insurance...).
create table if not exists public.services_vehicle_docs (
  account_id uuid not null references public.services_signups(id) on delete cascade,
  kind       text not null check (kind in ('licence', 'insurance', 'rc', 'puc', 'permit')),
  doc_no     text check (doc_no is null or char_length(doc_no) <= 40),
  expires_on date,
  updated_at timestamptz not null default now(),
  primary key (account_id, kind)
);
alter table public.services_vehicle_docs enable row level security;
revoke all on public.services_vehicle_docs from public, anon, authenticated;

drop function if exists public.services_docs_list();
create function public.services_docs_list()
returns table (kind text, doc_no text, expires_on date)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select d.kind, d.doc_no, d.expires_on from public.services_vehicle_docs d
   where d.account_id = public.services_account_id();
$fn$;
revoke all on function public.services_docs_list() from public, anon, authenticated;
grant execute on function public.services_docs_list() to authenticated;

drop function if exists public.services_doc_save(text, text, date);
create function public.services_doc_save(p_kind text, p_no text, p_expires date)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare v_acc uuid := public.services_account_id();
begin
  if v_acc is null then return query select false, 'signin'; return; end if;
  if p_kind not in ('licence', 'insurance', 'rc', 'puc', 'permit') then
    return query select false, 'bad_kind'; return;
  end if;
  insert into public.services_vehicle_docs (account_id, kind, doc_no, expires_on, updated_at)
  values (v_acc, p_kind, nullif(btrim(coalesce(p_no, '')), ''), p_expires, now())
  on conflict (account_id, kind) do update
     set doc_no = excluded.doc_no, expires_on = excluded.expires_on, updated_at = now();
  return query select true, 'saved';
end;
$fn$;
revoke all on function public.services_doc_save(text, text, date) from public, anon, authenticated;
grant execute on function public.services_doc_save(text, text, date) to authenticated;
notify pgrst, 'reload schema';
select 'part 2 done' as "155_part2";
