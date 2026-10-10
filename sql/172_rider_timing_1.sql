-- ===========================================================================
-- 172_rider_timing_1.sql -- the rider is looked for around the middle of the
-- cooking time (30 minutes into a 60 minute estimate), not the moment the
-- restaurant accepts. If the food is marked ready earlier, the rider is looked
-- for then. Run before 172_rider_timing_2.sql.
-- ===========================================================================
alter table public.services_orders add column if not exists rider_after timestamptz;

create or replace function public.services_order_post_job(p_order uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  o record;
  v_owner uuid;
  v_fee int;
  v_job uuid;
begin
  select x.* into o from public.services_orders x
   where x.id = p_order and x.mode = 'delivery' and x.status in ('accepted', 'ready') and x.job_id is null
   for update;
  if not found then return null; end if;
  select w.user_id into v_owner from public.services_workers w where w.id = o.worker_id and w.auto_rider;
  if v_owner is null then return null; end if;
  v_fee := case when o.delivery_fee_paise > 0 then o.delivery_fee_paise
                else public.services_delivery_fee(o.worker_id, o.lat, o.lng) end;
  insert into public.services_jobs (poster_id, poster_work, note, drop_text, fee_paise)
  select v_owner, o.worker_id,
         left('Order: ' || coalesce((select string_agg(l.qty || ' x ' || l.name, ', ')
                                       from public.services_order_lines l where l.order_id = o.id), ''), 300),
         left(coalesce(nullif(btrim(o.address_text), ''), 'See customer'), 200),
         v_fee
  returning id into v_job;
  update public.services_orders set job_id = v_job where id = o.id;
  return v_job;
end;
$fn$;
revoke all on function public.services_order_post_job(uuid) from public, anon, authenticated;

-- Posts the riders' jobs that have come due. Safe to call often, by anyone
-- signed in or by pg_cron: it only does work for orders that are due.
create or replace function public.services_orders_release_due()
returns int
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select x.id from public.services_orders x
     where x.mode = 'delivery' and x.status = 'accepted' and x.job_id is null
       and x.rider_after is not null and x.rider_after <= now()
     order by x.rider_after limit 20
  loop
    if public.services_order_post_job(r.id) is not null then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end;
$fn$;
revoke all on function public.services_orders_release_due() from public, anon;
grant execute on function public.services_orders_release_due() to authenticated;
notify pgrst, 'reload schema';
select '172 part 1 done' as "172_1";
