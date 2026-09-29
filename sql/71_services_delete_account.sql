-- ===========================================================================
-- 71_services_delete_account.sql
--
-- An admin removing a whole account, not just its listing.
--
-- ---------------------------------------------------------------------------
-- WHY A BLOCK LIST IS PART OF THIS AND NOT A SEPARATE FEATURE
-- ---------------------------------------------------------------------------
-- Without one, deleting an account is very close to a no-op, for a reason
-- that is not obvious until you trace it:
--
--   * The GoTrue user (auth.users) is what lets somebody sign in. The
--     services_signups row is what makes them a Dhundo account.
--   * auth.jsx signs in first, then calls services_signup_link() and, if no
--     services_signups row exists, CREATES ONE -- that is the recovery path
--     for a sign-up that died halfway through.
--   * So a deleted person signs in with the same PIN, gets a fresh
--     services_signups row, and 66's trigger hands them another ₹5.
--
-- Deleting the auth.users row as well would close that, and this file tries
-- to. But that is a write into Supabase's own schema and it can be refused
-- depending on who owns this function -- in which case the delete would have
-- silently become a "they are back tomorrow with a new welcome bonus".
--
-- So the phone number is recorded, and services_signup_link() refuses it.
-- Belt and braces, and the braces are the part that definitely works.
--
-- ---------------------------------------------------------------------------
-- WHAT HAPPENS TO THE MONEY
-- ---------------------------------------------------------------------------
-- 66 says the ledger is append-only and that a mistake is corrected with an
-- opposite row rather than an edit. Deleting an account is the one place that
-- gives way, and deliberately:
--
--   * THEIR ledger rows go, by the cascade 66 put on account_id. A balance
--     belonging to an account that no longer exists is not a record of
--     anything, and keeping it would mean holding a deleted person's data.
--   * SOMEBODY ELSE'S ₹3 for referring them SURVIVES. 68's ref_account_id is
--     ON DELETE SET NULL, so the row stays with its note ("For Bikash") and
--     only the pointer is dropped. The referrer did the work; the referred
--     person being removed later is not their doing.
--   * Anyone THEY referred keeps their account. 68's referred_by is also
--     SET NULL, so those people are simply no longer attributed to anybody.
--
-- ---------------------------------------------------------------------------
-- THIS IS NOT REVERSIBLE AND THERE IS A MILDER OPTION
-- ---------------------------------------------------------------------------
-- For a listing that is merely wrong, Hide it (reversible). For a listing
-- that must go but the person may come back, delete the LISTING (70) and
-- leave the account. Use this only when the person themselves should not be
-- here.
-- ===========================================================================

do $$
begin
  if to_regclass('public.services_signups') is null
     or to_regclass('public.services_wallet_entries') is null then
    raise exception 'Run 55 through 70 first.';
  end if;
end $$;

-- ===========================================================================
-- THE BLOCK LIST
-- ===========================================================================
create table if not exists public.services_blocked_phones (
  phone_digits text primary key,
  reason       text,
  blocked_by   uuid,
  blocked_at   timestamptz not null default now()
);

alter table public.services_blocked_phones enable row level security;
revoke all on public.services_blocked_phones from public, anon, authenticated;
-- No policy: nothing reaches this table except the definer functions below.
-- A person must not be able to test whether their number is on it.

-- ===========================================================================
-- SIGN-UP REFUSES A BLOCKED NUMBER
--
-- 59's function, copied from the file, with ONE block added after the phone
-- is normalised. Signature and return type are unchanged, so no overload
-- appears and no DROP is needed. Retyping the rest from memory is how 57 lost
-- two columns; this was pasted.
-- ===========================================================================
create or replace function public.services_signup_link(
  p_phone     text,
  p_full_name text default null
)
returns table (ok boolean, reason text, account_id uuid, phone text, full_name text, is_admin boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_digits text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  v_row    record;
begin
  if v_uid is null then
    return query select false, 'sign_in_required'::text, null::uuid, null::text, null::text, false; return;
  end if;
  if length(v_digits) not between 10 and 13 then
    return query select false, 'bad_phone'::text, null::uuid, null::text, null::text, false; return;
  end if;

  -- NEW IN 71. Checked before the already-linked branch on purpose: that
  -- branch is the recovery path, and it is exactly the door a removed person
  -- would otherwise walk back through.
  --
  -- Compared on the last ten digits so that 9862012345, 919862012345 and
  -- +91 98620 12345 are one number, as everywhere else in this project.
  if exists (
    select 1 from public.services_blocked_phones b
     where right(b.phone_digits, 10) = right(v_digits, 10)
  ) then
    -- Says 'blocked', plainly.
    --
    -- The cautious instinct is to answer 'phone_taken' so that nobody can
    -- use this to discover whether a number is on a list. That caution buys
    -- nothing HERE: this function only runs once auth.uid() is non-null, so
    -- whoever is asking has already signed in with that number's PIN. They
    -- are not probing somebody else's number, they are asking about their
    -- own, and answering "that number is already registered" would send a
    -- removed person round the sign-up loop forever trying to work out what
    -- they did wrong.
    return query select false, 'blocked'::text, null::uuid, null::text, null::text, false; return;
  end if;

  select * into v_row from public.services_signups su where su.auth_user_id = v_uid;
  if found then
    update public.services_signups su
       set full_name = coalesce(nullif(btrim(coalesce(p_full_name,'')),''), su.full_name)
     where su.auth_user_id = v_uid
    returning su.* into v_row;
    return query select true, 'already_linked'::text, v_row.id, v_row.phone::text,
                        v_row.full_name::text, v_row.is_admin; return;
  end if;

  if exists (
    select 1 from public.services_signups su
     where regexp_replace(su.phone, '\D', '', 'g') = v_digits
  ) then
    return query select false, 'phone_taken'::text, null::uuid, null::text, null::text, false; return;
  end if;

  insert into public.services_signups as su (auth_user_id, phone, full_name)
  values (v_uid, v_digits, nullif(btrim(coalesce(p_full_name,'')),''))
  returning su.* into v_row;

  return query select true, 'created'::text, v_row.id, v_row.phone::text,
                      v_row.full_name::text, v_row.is_admin;
end;
$$;

revoke all on function public.services_signup_link(text, text) from public, anon, authenticated;
grant execute on function public.services_signup_link(text, text) to authenticated;

-- ===========================================================================
-- DELETING THE ACCOUNT
-- ===========================================================================
drop function if exists public.services_admin_delete_account(uuid, boolean, text);

create or replace function public.services_admin_delete_account(
  p_account_id uuid,
  p_block      boolean default true,
  p_reason     text    default null
)
returns table (ok boolean, reason text, auth_user_removed boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me      uuid := public.services_account_id();
  v_row     public.services_signups%rowtype;
  v_worker  uuid;
  v_authed  boolean := false;
  d         record;
begin
  if not public.services_is_admin() then
    return query select false, 'not_admin'::text, false; return;
  end if;

  select * into v_row from public.services_signups where id = p_account_id;
  if not found then
    return query select false, 'not_found'::text, false; return;
  end if;

  -- An admin deleting themselves would leave the account that did it with no
  -- way back in, and if they are the only admin, nobody can approve anything
  -- ever again.
  if v_row.id = v_me then
    return query select false, 'cannot_delete_self'::text, false; return;
  end if;

  -- Their listings first, through 70's destroyer -- so the photographs and
  -- any ID document are actually removed from storage rather than orphaned
  -- by a cascade that only knows about rows.
  --
  -- A LOOP, not a single select. One account is supposed to have one
  -- listing, and the first version of this trusted that: it destroyed one
  -- and then the account delete failed on the foreign key from the other,
  -- which the test fixture hit immediately. "Supposed to" is not a
  -- constraint, and an admin should not meet a raw foreign-key error because
  -- a duplicate exists.
  for v_worker in
    select w.id from public.services_workers w where w.user_id = p_account_id
  loop
    select * into d from public.services_destroy_listing(v_worker);
  end loop;

  -- Their viewing history: "who looked at whom" about a person who is gone.
  delete from public.services_contact_views where viewer_id = p_account_id;

  if coalesce(p_block, true) then
    insert into public.services_blocked_phones (phone_digits, reason, blocked_by)
    values (regexp_replace(coalesce(v_row.phone, ''), '\D', '', 'g'),
            nullif(btrim(coalesce(p_reason, '')), ''), v_me)
    on conflict (phone_digits) do update
      set reason = coalesce(excluded.reason, public.services_blocked_phones.reason),
          blocked_at = now();
  end if;

  -- The GoTrue user, so the PIN stops working at all. This is a write into
  -- Supabase's own schema and may be refused depending on who owns this
  -- function; a failure is caught and REPORTED rather than swallowed,
  -- because "deleted but can still sign in" is the one outcome an admin must
  -- not be left believing is a clean delete. The block list above covers it
  -- either way.
  begin
    delete from auth.users where id = v_row.auth_user_id;
    v_authed := true;
  exception when others then
    v_authed := false;
  end;

  -- Last. Cascades take their wallet rows with it; 68's SET NULL keeps other
  -- people's referral payments intact.
  delete from public.services_signups where id = p_account_id;

  return query select true,
                      (case when coalesce(p_block, true) then 'deleted_and_blocked'
                            else 'deleted' end)::text,
                      v_authed;
end;
$$;

revoke all on function public.services_admin_delete_account(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.services_admin_delete_account(uuid, boolean, text) to authenticated;

-- ===========================================================================
-- UNBLOCKING, because a wrong number will be typed eventually
-- ===========================================================================
create or replace function public.services_admin_unblock_phone(p_phone text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if not public.services_is_admin() then
    return query select false, 'not_admin'::text; return;
  end if;
  delete from public.services_blocked_phones
   where right(phone_digits, 10) = right(v_digits, 10);
  if not found then
    return query select false, 'not_blocked'::text; return;
  end if;
  return query select true, 'unblocked'::text;
end;
$$;

revoke all on function public.services_admin_unblock_phone(text) from public, anon, authenticated;
grant execute on function public.services_admin_unblock_phone(text) to authenticated;

-- ===========================================================================
-- VERIFY
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'block_table', (to_regclass('public.services_blocked_phones') is not null),
  'block_table_grants_to_clients', (select count(*) from information_schema.role_table_grants
                                     where table_schema='public'
                                       and table_name='services_blocked_phones'
                                       and grantee in ('anon','authenticated')),
  'blocked_now', (select count(*) from public.services_blocked_phones),
  'signup_link_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                             where n.nspname='public' and p.proname='services_signup_link'),
  'signup_link_checks_block', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                                where n.nspname='public' and p.proname='services_signup_link'
                                  and pg_get_functiondef(p.oid) like '%services_blocked_phones%'),
  'delete_account_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                                where n.nspname='public' and p.proname='services_admin_delete_account'),
  'unblock_overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public' and p.proname='services_admin_unblock_phone'),
  'wallet_cascades_on_account', (select confdeltype from pg_constraint
                                  where conrelid='public.services_wallet_entries'::regclass
                                    and contype='f'
                                    and conname like '%account_id%' limit 1),
  'accounts', (select count(*) from public.services_signups),
  'expected', 'block_table true; block_table_grants_to_clients 0; signup_link_checks_block 1; every overload count 1; wallet_cascades_on_account "c"'
)) as "71_verify";
