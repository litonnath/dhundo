-- 241: phone check by WhatsApp message the person sends to us (no template, no cost).
-- The wa-webhook function matches the sender's real number and the code.
create table if not exists public.services_phone_claims (
  auth_user_id uuid primary key,
  phone        text not null,
  code         text not null,
  expires_at   timestamptz not null,
  made_at      timestamptz not null default now(),
  made_today   int not null default 1,
  day          date not null default current_date
);
alter table public.services_phone_claims enable row level security;
revoke all on public.services_phone_claims from public, anon, authenticated;
notify pgrst, 'reload schema';
select '241 done' as "241_phone_claim";
