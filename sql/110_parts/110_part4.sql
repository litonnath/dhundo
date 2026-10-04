-- ===========================================================================
-- 110_part4.sql -- listing photo and avatar addresses must point at the
-- photo storage, and a shorter timeout for anonymous callers.
-- Optional extra lock: name your own storage address once, so only it works:
--   insert into services_settings (name, value) values
--   (storage_prefix, https://YOURREF.supabase.co/storage/v1/object/public/services-photos/)
--   on conflict (name) do update set value = excluded.value;
-- Only addresses that are NEW or CHANGED are checked, so old listings keep saving.
-- ===========================================================================
create or replace function public.services_photo_url_ok(p text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select p ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/services-photos/[0-9a-f-]{36}/[^?#[:space:]]+$'
     and (coalesce(public.services_setting('storage_prefix'), '') = ''
          or p like public.services_setting('storage_prefix') || '%');
$fn$;
revoke all on function public.services_photo_url_ok(text) from public, anon, authenticated;

create or replace function public.services_check_photo_urls()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  p text;
begin
  if new.avatar_url is not null and new.avatar_url <> ''
     and (tg_op = 'INSERT' or new.avatar_url is distinct from old.avatar_url)
     and not public.services_photo_url_ok(new.avatar_url) then
    raise exception 'bad_photo_url';
  end if;
  foreach p in array coalesce(new.photos, '{}'::text[]) loop
    if (tg_op = 'INSERT' or not (p = any (coalesce(old.photos, '{}'::text[]))))
       and not public.services_photo_url_ok(p) then
      raise exception 'bad_photo_url';
    end if;
  end loop;
  return new;
end;
$fn$;

drop trigger if exists services_workers_check_photo_urls on public.services_workers;
create trigger services_workers_check_photo_urls
  before insert or update on public.services_workers
  for each row execute function public.services_check_photo_urls();

alter role anon set statement_timeout = '6s';
notify pgrst, 'reload config';

select 'part 4 of 5 done' as "110_part4";
