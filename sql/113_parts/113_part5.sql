-- ===========================================================================
-- 113_part5.sql -- the list each side sees: shop jobs and rider jobs, the other
-- side name and phone shown only once the job is accepted.
-- ===========================================================================
create or replace function public.services_my_jobs()
returns table (id uuid, role text, status text, note text, drop_text text, fee_paise int,
               other_name text, other_phone text, created_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select j.id, 'shop'::text, case when j.status = 'open' and j.expires_at <= now() then 'expired' else j.status end,
         j.note, j.drop_text, j.fee_paise,
         case when j.rider_work is not null then r.full_name::text end,
         case when j.rider_work is not null then r.phone::text end,
         j.created_at, j.expires_at
    from public.services_jobs j
    left join public.services_workers r on r.id = j.rider_work
   where j.poster_id = public.services_account_id() and j.created_at > now() - interval '3 days'
  union all
  select j.id, 'rider'::text, j.status, j.note, j.drop_text, j.fee_paise,
         coalesce(nullif(btrim(p.business_name), ''), p.full_name)::text, p.phone::text,
         j.created_at, j.expires_at
    from public.services_jobs j
    join public.services_workers rw on rw.id = j.rider_work and rw.user_id = public.services_account_id()
    join public.services_workers p on p.id = j.poster_work
   where j.created_at > now() - interval '3 days'
  order by 9 desc;
$fn$;
revoke all on function public.services_my_jobs() from public, anon, authenticated;
grant execute on function public.services_my_jobs() to authenticated;

notify pgrst, 'reload schema';
select 'done' as "113_part5";
