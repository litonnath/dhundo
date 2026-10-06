-- 142 part 1: delivery jobs go only to delivery riders (not to taxis, tractors
-- and other vehicles). Replaces the functions from 120 part 5, 113 part 3 and 118 part 5.
create or replace function public.services_is_delivery_trade(p_slug text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (select 1 from public.services_trades t
                  where t.slug = p_slug and (t.slug ~* 'deliver' or t.name_en ~* 'deliver'));
$fn$;
revoke all on function public.services_is_delivery_trade(text) from public, anon, authenticated;

create or replace function public.services_jobs_nearby()
returns table (id uuid, shop text, note text, drop_text text, fee_paise int,
               km double precision, created_at timestamptz, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  v_lat double precision;
  v_lng double precision;
begin
  if v_me is null then return; end if;
  select pr.lat, pr.lng into v_lat, v_lng
    from public.services_workers w
    join public.services_presence pr on pr.worker_id = w.id
   where w.user_id = v_me and w.status = 'approved' and w.serves_delivery
     and public.services_is_delivery_trade(w.trade_slug)
     and pr.online_until > now()
     and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
   limit 1;
  if v_lat is null then return; end if;
  return query
    select j.id, coalesce(nullif(btrim(p.business_name), ''), p.full_name)::text, j.note, j.drop_text,
           j.fee_paise,
           round(public.services_km(v_lat, v_lng, p.lat, p.lng)::numeric, 1)::double precision,
           j.created_at, j.expires_at
      from public.services_jobs j
      join public.services_workers p on p.id = j.poster_work
     where j.status = 'open' and j.expires_at > now()
       and p.lat is not null and public.services_km(v_lat, v_lng, p.lat, p.lng) <= 10
     order by public.services_km(v_lat, v_lng, p.lat, p.lng), j.created_at desc
     limit 20;
end;
$fn$;
revoke all on function public.services_jobs_nearby() from public, anon, authenticated;
grant execute on function public.services_jobs_nearby() to authenticated;

create or replace function public.services_trg_job_new()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  p record;
begin
  select w.lat, w.lng into p from public.services_workers w where w.id = new.poster_work;
  if p.lat is null then return new; end if;
  perform public.services_notify(r.user_id, 'job_new', null)
    from (select w.user_id
            from public.services_workers w
            join public.services_presence pr on pr.worker_id = w.id
           where w.status = 'approved' and w.serves_delivery
             and public.services_is_delivery_trade(w.trade_slug)
             and pr.online_until > now()
             and pr.seen_at > now() - make_interval(mins => public.services_presence_fresh_minutes())
             and public.services_km(pr.lat, pr.lng, p.lat, p.lng) <= 10
           limit 40) r;
  return new;
end;
$fn$;
notify pgrst, 'reload schema';
select 'part 1 of 3 done' as "142_part1";
