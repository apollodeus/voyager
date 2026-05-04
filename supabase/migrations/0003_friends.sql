-- =============================================================================
-- Friends feature: profiles, friendships, RPC for email lookup, RLS updates.
-- =============================================================================

-- 1. Tables (created first so policies can reference both safely) ------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index friendships_requester_idx on public.friendships(requester_id);
create index friendships_addressee_idx on public.friendships(addressee_id);

-- Prevent A→B and B→A from coexisting: enforce uniqueness on the unordered pair.
create unique index friendships_unique_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- 2. Row Level Security --------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;

-- Profiles: own + anyone you have a friendship row with (pending or accepted).
create policy "Users can view their own profile or related profiles"
  on public.profiles for select
  using (
    (select auth.uid()) = id
    or exists (
      select 1 from public.friendships
      where (
        (requester_id = (select auth.uid()) and addressee_id = profiles.id)
        or (addressee_id = (select auth.uid()) and requester_id = profiles.id)
      )
    )
  );

create policy "Users can update their own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Friendships: both parties can see; requester can insert; recipient can accept;
-- either side can delete (decline / unfriend).
create policy "Friendship rows visible to both parties"
  on public.friendships for select
  using (
    (select auth.uid()) = requester_id
    or (select auth.uid()) = addressee_id
  );

create policy "Users can send friend requests"
  on public.friendships for insert
  with check (
    (select auth.uid()) = requester_id
    and status = 'pending'
  );

create policy "Recipients can accept pending requests"
  on public.friendships for update
  using ((select auth.uid()) = addressee_id and status = 'pending')
  with check ((select auth.uid()) = addressee_id and status = 'accepted');

create policy "Either party can remove a friendship"
  on public.friendships for delete
  using (
    (select auth.uid()) = requester_id
    or (select auth.uid()) = addressee_id
  );

-- 3. Grants --------------------------------------------------------------------

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.friendships to authenticated;

-- 4. Trigger: auto-create a profile row when a new user signs up. ------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that signed up before this migration.
insert into public.profiles (id, email)
select id, email from auth.users
where id not in (select id from public.profiles);

-- 5. RPC for email lookup ------------------------------------------------------
-- Bypasses profiles RLS (security definer) since you obviously can't see a
-- user's profile until you've already sent them a request — chicken/egg.
-- Trade-off: enables email-existence enumeration. Acceptable for MVP among
-- a small trusted user base; revisit (rate-limit, CAPTCHA, invite-only) before
-- public launch.

create or replace function public.find_user_by_email(lookup_email text)
returns table (id uuid, email text, display_name text)
language sql
security definer
set search_path = ''
stable
as $$
  select id, email, display_name
  from public.profiles
  where email = lookup_email
  limit 1;
$$;

grant execute on function public.find_user_by_email(text) to authenticated;

-- 6. Update trips RLS to include accepted friends -----------------------------

drop policy "Users can view their own trips" on public.trips;

create policy "Users can view own and friends' trips"
  on public.trips for select
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.friendships
      where status = 'accepted'
      and (
        (requester_id = (select auth.uid()) and addressee_id = trips.user_id)
        or (addressee_id = (select auth.uid()) and requester_id = trips.user_id)
      )
    )
  );
