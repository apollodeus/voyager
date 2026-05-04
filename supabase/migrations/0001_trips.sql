-- Trips table: each row is a planned trip belonging to one user.
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination text not null,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.trips enable row level security;

create index trips_user_id_idx on public.trips(user_id);
create index trips_start_date_idx on public.trips(start_date);

-- RLS policies: a user can only see and modify their own trips.
-- We will loosen "select" later to also allow friends to see each other's trips.
create policy "Users can view their own trips"
  on public.trips for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own trips"
  on public.trips for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own trips"
  on public.trips for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own trips"
  on public.trips for delete
  using ((select auth.uid()) = user_id);
