-- 153_part1.sql -- customer ratings and complaints for any business.
-- A rating needs a finished order; a complaint goes only to the owner.
create table if not exists public.services_reviews (
  id          uuid primary key default gen_random_uuid(),
  worker_id   uuid not null references public.services_workers(id) on delete cascade,
  reviewer_id uuid not null references public.services_signups(id) on delete cascade,
  kind        text not null default 'order' check (kind in ('order', 'ride', 'job', 'item', 'hire')),
  ref_id      uuid,
  stars       int not null check (stars between 1 and 5),
  comment     text check (comment is null or char_length(comment) <= 300),
  complaint   boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index if not exists services_reviews_once on public.services_reviews (reviewer_id, kind, ref_id) where ref_id is not null;
create index if not exists services_reviews_worker on public.services_reviews (worker_id, created_at desc);
alter table public.services_reviews enable row level security;
revoke all on public.services_reviews from public, anon, authenticated;

drop function if exists public.services_review_add(uuid, text, uuid, int, text, boolean);
create function public.services_review_add(p_worker uuid, p_kind text, p_ref uuid, p_stars int, p_comment text, p_complaint boolean)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_acc uuid := public.services_account_id();
  v_kind text := coalesce(nullif(p_kind, ''), 'order');
  v_w uuid := p_worker;
begin
  if v_acc is null then return query select false, 'signin'; return; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then return query select false, 'bad_stars'; return; end if;
  -- Only a finished order can be rated for now: it is the one thing the database can check.
  if v_kind <> 'order' then return query select false, 'bad_kind'; return; end if;
  if v_kind = 'order' then
    select o.worker_id into v_w from public.services_orders o
     where o.id = p_ref and o.customer_id = v_acc and o.status = 'delivered';
    if v_w is null then return query select false, 'not_delivered'; return; end if;
  end if;
  if v_w is null then return query select false, 'no_target'; return; end if;
  if exists (select 1 from public.services_workers w where w.id = v_w and w.user_id = v_acc) then
    return query select false, 'own'; return;
  end if;
  insert into public.services_reviews (worker_id, reviewer_id, kind, ref_id, stars, comment, complaint)
  values (v_w, v_acc, v_kind, p_ref, p_stars, nullif(left(btrim(coalesce(p_comment, '')), 300), ''), coalesce(p_complaint, false));
  return query select true, 'saved';
exception when unique_violation then
  return query select false, 'already';
end;
$fn$;
revoke all on function public.services_review_add(uuid, text, uuid, int, text, boolean) from public, anon, authenticated;
grant execute on function public.services_review_add(uuid, text, uuid, int, text, boolean) to authenticated;
notify pgrst, 'reload schema';
select 'part 1 done' as "153_part1";
