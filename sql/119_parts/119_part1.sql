-- ===========================================================================
-- 119_part1.sql -- BOOKINGS FOR ANY LENGTH OF TIME. Not only a week, month,
-- quarter or year: a start date and time, and a length from 5 minutes to a
-- year. Needs 114 (bookings).
-- ===========================================================================
alter table public.services_bookings
  add column if not exists start_at timestamptz,
  add column if not exists duration_mins int check (duration_mins is null or duration_mins between 5 and 525600);

alter table public.services_bookings drop constraint if exists services_bookings_period_check;
alter table public.services_bookings alter column period drop not null;
alter table public.services_bookings alter column start_on drop not null;

update public.services_bookings
   set start_at = coalesce(start_at, start_on::timestamptz),
       duration_mins = coalesce(duration_mins, case period when 'week' then 10080 when 'month' then 43200
                                                           when 'quarter' then 129600 else 525600 end)
 where start_at is null;

drop index if exists public.services_bookings_one_open;

select 'part 1 of 3 done' as "119_part1";
