-- ===========================================================================
-- 163_gst_rates.sql -- GST on what a customer buys from a restaurant or a
-- shop. One rate for restaurants and one for shops, set by the admin; every
-- order uses them. Shown on the customer's bill (item total + GST).
-- ===========================================================================
create table if not exists public.services_gst_rates (
  kind    text primary key check (kind in ('restaurant', 'shop')),
  percent numeric(4,1) not null default 0 check (percent between 0 and 40)
);
alter table public.services_gst_rates enable row level security;
revoke all on public.services_gst_rates from public, anon, authenticated;
insert into public.services_gst_rates (kind, percent) values ('restaurant', 18), ('shop', 18)
on conflict (kind) do nothing;

create or replace function public.services_gst_rates()
returns table (kind text, percent numeric)
language sql stable security definer set search_path to 'public'
as $fn$ select g.kind, g.percent from public.services_gst_rates g order by g.kind; $fn$;
revoke all on function public.services_gst_rates() from public;
grant execute on function public.services_gst_rates() to anon, authenticated;

create or replace function public.services_gst_set(p_kind text, p_percent numeric)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path to 'public'
as $fn$
begin
  if not public.services_is_admin() then
    raise exception 'not_admin' using errcode = 'PT403';
  end if;
  update public.services_gst_rates g
     set percent = least(greatest(coalesce(p_percent, 0), 0), 40)
   where g.kind = p_kind;
  if not found then
    return query select false, 'no_such_kind'::text;
    return;
  end if;
  return query select true, 'saved'::text;
end;
$fn$;
revoke all on function public.services_gst_set(text, numeric) from public, anon;
grant execute on function public.services_gst_set(text, numeric) to authenticated;
notify pgrst, 'reload schema';
select '163 gst rates done' as "163";
