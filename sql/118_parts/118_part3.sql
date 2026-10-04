-- ===========================================================================
-- 118_part3.sql -- put an alert in the queue, only for people who turned
-- alerts on, so the queue does not fill with messages nobody can receive.
-- ===========================================================================
create or replace function public.services_notify(p_user uuid, p_kind text, p_extra text default null)
returns void
language sql
security definer
set search_path to 'public'
as $fn$
  insert into public.services_notify_queue (user_id, kind, extra)
  select p_user, p_kind, p_extra
   where p_user is not null
     and exists (select 1 from public.services_push_subs s where s.user_id = p_user);
$fn$;
revoke all on function public.services_notify(uuid, text, text) from public, anon, authenticated;

create or replace function public.services_trg_order_new()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  perform public.services_notify(
    (select w.user_id from public.services_workers w where w.id = new.worker_id),
    'order_new', (new.total_paise / 100)::text);
  return new;
end;
$fn$;
drop trigger if exists services_order_new on public.services_orders;
create trigger services_order_new after insert on public.services_orders
  for each row execute function public.services_trg_order_new();

select 'part 3 of 6 done' as "118_part3";
