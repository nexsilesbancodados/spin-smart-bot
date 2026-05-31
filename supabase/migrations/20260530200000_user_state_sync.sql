-- User state sync: per-user JSONB storage for client state keys
-- Used by lib/sync.ts to keep localStorage in sync across devices

create table if not exists public.user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists user_state_user_updated_idx
  on public.user_state(user_id, updated_at desc);

alter table public.user_state enable row level security;

drop policy if exists "users select own state" on public.user_state;
create policy "users select own state"
  on public.user_state
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users insert own state" on public.user_state;
create policy "users insert own state"
  on public.user_state
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update own state" on public.user_state;
create policy "users update own state"
  on public.user_state
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete own state" on public.user_state;
create policy "users delete own state"
  on public.user_state
  for delete
  to authenticated
  using (auth.uid() = user_id);
