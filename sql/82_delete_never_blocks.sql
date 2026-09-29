-- ===========================================================================
-- 82_delete_never_blocks.sql
--
-- Deleting an account no longer blocks its phone number.
--
-- services_admin_delete_account (71) put the number on
-- services_blocked_phones whenever p_block was true -- and its default was
-- true. A deleted number then could not sign up again ("This account has
-- been removed from Dhundo") until somebody removed it by hand.
--
-- This re-creates the function from its current definition with both
-- places that read p_block replaced by false, so it never blocks whatever
-- is sent. It also clears the numbers blocked so far. The signup check
-- stays in place; with nothing on the list it never refuses anybody.
-- ===========================================================================

drop table if exists _82_done;
create temporary table _82_done (fn text, changed boolean);

do $fn$
declare
  f   record;
  old text;
  new text;
begin
  for f in
    select p.oid, p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = 'services_admin_delete_account'
  loop
    old := pg_get_functiondef(f.oid);
    new := regexp_replace(old, 'coalesce\(\s*p_block\s*,\s*(true|false)\s*\)', 'false', 'gi');
    if new <> old then
      execute new;
    end if;
    insert into _82_done values (f.proname, new <> old);
  end loop;
end $fn$;

drop table if exists _82_cleared;
create temporary table _82_cleared as
  select phone_digits from public.services_blocked_phones;
delete from public.services_blocked_phones;

select jsonb_pretty(jsonb_build_object(
  'delete_function_changed', (select coalesce(jsonb_object_agg(fn, changed), '{}'::jsonb) from _82_done),
  'still_reads_p_block', (select count(*) from pg_proc
                           where proname = 'services_admin_delete_account'
                             and prosrc ~* 'coalesce\(\s*p_block'),
  'numbers_unblocked', (select count(*) from _82_cleared),
  'blocked_now', (select count(*) from public.services_blocked_phones),
  'expected', 'delete_function_changed true; still_reads_p_block 0; blocked_now 0'
)) as "82_verify";
