-- 152_part1.sql -- how a business gets paid. Customers pay the business
-- directly (cash or UPI); Dhundo takes no part and no commission. This stores
-- what the owner accepts, their UPI id and their licence numbers.
create table if not exists public.services_biz_payment (
  account_id  uuid primary key references public.services_signups(id) on delete cascade,
  accepts_cash boolean not null default true,
  accepts_upi  boolean not null default false,
  upi_id       text check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,32}$'),
  gst_no       text check (gst_no is null or char_length(gst_no) between 5 and 20),
  licence_no   text check (licence_no is null or char_length(licence_no) between 3 and 30),
  updated_at   timestamptz not null default now()
);
alter table public.services_biz_payment enable row level security;
revoke all on public.services_biz_payment from public, anon, authenticated;

drop function if exists public.services_biz_payment_get();
create function public.services_biz_payment_get()
returns table (accepts_cash boolean, accepts_upi boolean, upi_id text, gst_no text, licence_no text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select coalesce(p.accepts_cash, true), coalesce(p.accepts_upi, false), p.upi_id, p.gst_no, p.licence_no
    from (select 1) x
    left join public.services_biz_payment p on p.account_id = public.services_account_id();
$fn$;
revoke all on function public.services_biz_payment_get() from public, anon, authenticated;
grant execute on function public.services_biz_payment_get() to authenticated;

drop function if exists public.services_biz_payment_save(boolean, boolean, text, text, text);
create function public.services_biz_payment_save(
  p_cash boolean, p_upi_ok boolean, p_upi text, p_gst text, p_licence text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_acc  uuid := public.services_account_id();
  v_upi  text := nullif(btrim(coalesce(p_upi, '')), '');
begin
  if v_acc is null then return query select false, 'signin'; return; end if;
  if not exists (select 1 from public.services_workers w where w.user_id = v_acc) then
    return query select false, 'no_listing'; return;
  end if;
  if v_upi is not null and v_upi !~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,32}$' then
    return query select false, 'bad_upi'; return;
  end if;
  if coalesce(p_upi_ok, false) and v_upi is null then
    return query select false, 'upi_needed'; return;
  end if;
  insert into public.services_biz_payment (account_id, accepts_cash, accepts_upi, upi_id, gst_no, licence_no, updated_at)
  values (v_acc, coalesce(p_cash, true), coalesce(p_upi_ok, false), v_upi,
          nullif(btrim(coalesce(p_gst, '')), ''), nullif(btrim(coalesce(p_licence, '')), ''), now())
  on conflict (account_id) do update
     set accepts_cash = excluded.accepts_cash, accepts_upi = excluded.accepts_upi, upi_id = excluded.upi_id,
         gst_no = excluded.gst_no, licence_no = excluded.licence_no, updated_at = now();
  return query select true, 'saved';
end;
$fn$;
revoke all on function public.services_biz_payment_save(boolean, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.services_biz_payment_save(boolean, boolean, text, text, text) to authenticated;
notify pgrst, 'reload schema';
select 'part 1 done' as "152_part1";
