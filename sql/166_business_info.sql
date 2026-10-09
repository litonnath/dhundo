-- ===========================================================================
-- 166_business_info.sql -- Dhundo's registered business details (legal name,
-- GSTIN, address). The admin enters them; customers see them on their bill.
-- Nothing is shown until an admin saves a valid GSTIN.
-- ===========================================================================
create table if not exists public.services_business_info (
  id         boolean primary key default true check (id),
  legal_name text not null default '',
  gstin      text not null default '',
  address    text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.services_business_info enable row level security;
revoke all on public.services_business_info from public, anon, authenticated;
insert into public.services_business_info (id) values (true) on conflict (id) do nothing;

create or replace function public.services_business_info()
returns table (legal_name text, gstin text, address text)
language sql stable security definer set search_path to 'public'
as $fn$ select b.legal_name, b.gstin, b.address from public.services_business_info b; $fn$;
revoke all on function public.services_business_info() from public;
grant execute on function public.services_business_info() to anon, authenticated;

create or replace function public.services_business_info_set(p_name text, p_gstin text, p_address text)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path to 'public'
as $fn$
declare v_g text := upper(btrim(coalesce(p_gstin, '')));
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  if v_g <> '' and v_g !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    return query select false, 'bad_gstin'::text;
    return;
  end if;
  update public.services_business_info
     set legal_name = left(btrim(coalesce(p_name, '')), 120), gstin = v_g,
         address = left(btrim(coalesce(p_address, '')), 300), updated_at = now();
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_business_info_set(text, text, text) from public, anon;
grant execute on function public.services_business_info_set(text, text, text) to authenticated;
notify pgrst, 'reload schema';
select '166 business info done' as "166";
