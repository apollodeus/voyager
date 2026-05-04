-- Open-ended trips: a trip can be "ongoing" with no known end date.
-- Semantics: an open-ended trip places its owner at `destination` from
-- `start_date` indefinitely, until a later trip's start_date implicitly
-- closes it.

alter table public.trips alter column end_date drop not null;

-- Defense in depth: when end_date is set, it must be on or after start_date.
alter table public.trips
  add constraint trips_dates_check
  check (end_date is null or end_date >= start_date);
