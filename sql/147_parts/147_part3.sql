-- 147 part 3: messages on a delivery job between the shop, the rider and the
-- customer whose order it is. Saved in the database. They go with the job.
create table if not exists public.services_job_messages (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.services_jobs(id) on delete cascade,
  sender_id  uuid not null references public.services_signups(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists services_job_messages_idx on public.services_job_messages (job_id, created_at);
alter table public.services_job_messages enable row level security;
revoke all on public.services_job_messages from public, anon, authenticated;

create or replace function public.services_job_chat_list(p_job uuid)
returns table (id uuid, mine boolean, body text, created_at timestamptz, who text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select m.id, m.sender_id = public.services_account_id(), m.body, m.created_at,
         case when m.sender_id = j.poster_id then 'shop'
              when m.sender_id = rw.user_id then 'rider' else 'customer' end
    from public.services_job_messages m
    join public.services_jobs j on j.id = m.job_id
    left join public.services_workers rw on rw.id = j.rider_work
    left join public.services_orders o on o.job_id = j.id
   where m.job_id = p_job
     and public.services_account_id() in (j.poster_id, rw.user_id, o.customer_id)
   order by m.created_at
   limit 200;
$fn$;
revoke all on function public.services_job_chat_list(uuid) from public, anon, authenticated;
grant execute on function public.services_job_chat_list(uuid) to authenticated;

create or replace function public.services_job_chat_send(p_job uuid, p_body text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := public.services_account_id();
  j record;
  v_rider uuid;
  v_cust uuid;
begin
  if v_me is null then
    return query select false, 'sign_in_required'::text;
    return;
  end if;
  perform public.services_rate_guard('jobchat', v_me::text, 200, 3600);
  if length(btrim(coalesce(p_body, ''))) < 1 then
    return query select false, 'empty'::text;
    return;
  end if;
  select x.* into j from public.services_jobs x where x.id = p_job and x.status in ('accepted', 'picked_up');
  if not found then
    return query select false, 'closed'::text;
    return;
  end if;
  select w.user_id into v_rider from public.services_workers w where w.id = j.rider_work;
  select o.customer_id into v_cust from public.services_orders o where o.job_id = j.id limit 1;
  if v_me not in (j.poster_id, v_rider) and v_me is distinct from v_cust then
    return query select false, 'closed'::text;
    return;
  end if;
  insert into public.services_job_messages (job_id, sender_id, body) values (p_job, v_me, left(btrim(p_body), 300));
  perform public.services_notify(u, 'job_msg', left(btrim(p_body), 80))
    from (select distinct x from unnest(array[j.poster_id, v_rider, v_cust]) as x where x is not null and x <> v_me) r(u);
  return query select true, 'sent'::text;
end;
$fn$;
revoke all on function public.services_job_chat_send(uuid, text) from public, anon, authenticated;
grant execute on function public.services_job_chat_send(uuid, text) to authenticated;
notify pgrst, 'reload schema';
select 'part 3 of 3 done' as "147_part3";
