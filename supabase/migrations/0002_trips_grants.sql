-- Grant API access on the trips table to the authenticated role.
-- Required because the Supabase project setting "automatically expose new
-- tables" is disabled (we manually opt-in tables for tighter security).
-- RLS policies still enforce per-row access; this only opens the door so
-- those policies get a chance to run.
grant select, insert, update, delete on table public.trips to authenticated;
