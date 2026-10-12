-- 239_popups_1.sql -- a message that pops up inside the app, for the customer and for the person who did the work, when a
-- ride is completed, an order is delivered, a booking is completed, or a payment goes through. Part 1 of 3: the
-- store and the two calls the app uses. Run 239_popups_2 and _3 next.
create table if not exists public.services_popups (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  kind text not null,
  amount_paise int,
  ref_id uuid,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists services_popups_open on public.services_popups (account_id) where seen_at is null;
alter table public.services_popups enable row level security;
revoke all on public.services_popups from public, anon, authenticated;

create or replace function public.services_popup(p_acct uuid, p_kind text, p_amount int default null, p_ref uuid default null)
returns void language sql security definer set search_path to 'public' as $fn$
  insert into public.services_popups (account_id, kind, amount_paise, ref_id) select p_acct, p_kind, p_amount, p_ref where p_acct is not null;
$fn$;
revoke all on function public.services_popup(uuid, text, int, uuid) from public, anon, authenticated;

create or replace function public.services_popups_pending()
returns table (id uuid, kind text, amount_paise int, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $fn$
  select p.id, p.kind, p.amount_paise, p.created_at from public.services_popups p
   where p.account_id = public.services_account_id() and p.seen_at is null and p.created_at > now() - interval '2 days'
   order by p.created_at limit 10;
$fn$;
revoke all on function public.services_popups_pending() from public, anon;
grant execute on function public.services_popups_pending() to authenticated;

create or replace function public.services_popups_seen(p_ids uuid[])
returns void language sql security definer set search_path to 'public' as $fn$
  update public.services_popups set seen_at = now() where id = any (p_ids) and account_id = public.services_account_id() and seen_at is null;
$fn$;
revoke all on function public.services_popups_seen(uuid[]) from public, anon;
grant execute on function public.services_popups_seen(uuid[]) to authenticated;
notify pgrst, 'reload schema';
select '239_1 done' as "239_1";
