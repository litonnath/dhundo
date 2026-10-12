-- 240: phone check by WhatsApp code (no SMS, no DLT). The edge function phone-otp
-- keeps hashed codes here; nobody can read or write this table from the app.
create table if not exists public.services_phone_otps (
  auth_user_id uuid primary key,
  phone        text not null,
  code_hash    text not null,
  expires_at   timestamptz not null,
  tries        int not null default 0,
  sent_at      timestamptz not null default now(),
  sent_today   int not null default 1,
  day          date not null default current_date
);
alter table public.services_phone_otps enable row level security;
revoke all on public.services_phone_otps from public, anon, authenticated;
notify pgrst, 'reload schema';
select '240 done' as "240_phone_otp";
