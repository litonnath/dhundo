-- 93 part 5 of 5: guessing referral codes. Same function as 68, plus a limit
-- of ten tries an hour.

create or replace function public.services_apply_referral(p_code text)
returns table (ok boolean, reason text, referrer_name text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me       uuid := public.services_account_id();
  v_code     text := upper(btrim(coalesce(p_code, '')));
  v_ref      public.services_signups%rowtype;
  v_mine     public.services_signups%rowtype;
begin
  if v_me is null then
    return query select false, 'not_signed_in'::text, null::text; return;
  end if;
  if v_code = '' then
    return query select false, 'no_code'::text, null::text; return;
  end if;

  -- Codes are six characters: guessing them is the attack, so tries are few.
  perform public.services_rate_guard('referral', v_me::text, 10, 3600);

  select * into v_mine from public.services_signups where id = v_me;

  -- Set once and never again. Otherwise somebody swaps the code the day
  -- before approval and the ₹3 goes to whoever asked most recently.
  if v_mine.referred_by is not null then
    return query select false, 'already_referred'::text, null::text; return;
  end if;

  select * into v_ref from public.services_signups where referral_code = v_code;
  if not found then
    return query select false, 'bad_code'::text, null::text; return;
  end if;

  -- Your own code. The obvious attempt, and the only self-referral this
  -- function can actually see -- a second account on a second phone is
  -- indistinguishable from a real friend, which is why the money waits for
  -- a human to approve the listing.
  if v_ref.id = v_me then
    return query select false, 'self_referral'::text, null::text; return;
  end if;

  -- Too late once you are already published: the referral is meant to bring
  -- somebody new, not to be attached to a listing that already went through.
  if exists (
    select 1 from public.services_workers w
     where w.user_id = v_me and w.status = 'approved'
  ) then
    return query select false, 'too_late'::text, null::text; return;
  end if;

  update public.services_signups
     set referred_by = v_ref.id, referred_at = now()
   where id = v_me;

  return query select true, 'linked'::text, v_ref.full_name::text;
end;
$$;

notify pgrst, 'reload schema';
select 'part 5 done' as "93_part5";
