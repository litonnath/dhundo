-- 248: the app is now called DhundoNow. This rewrites the name inside the database functions that write
-- visible text (wallet history notes, support replies, alerts). Safe to run again: it only touches functions that
-- still contain the old name, as a whole word. Text already saved in old wallet entries is left as it was.
do $$
declare r record; n int := 0;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.prokind = 'f' and p.proname like 'services\_%'
       and pg_get_functiondef(p.oid) ~ '\mDhundo\M'
  loop
    execute regexp_replace(r.def, '\mDhundo\M', 'DhundoNow', 'g');
    n := n + 1;
  end loop;
  raise notice '% functions updated', n;
end $$;
notify pgrst, 'reload schema';
select '248 done' as "248_brand_rename";
