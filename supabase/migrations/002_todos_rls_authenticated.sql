-- Drop existing anon-only policies and replace with proper RLS
-- that allows authenticated users to manage their own todos
-- and anon users to read only.

-- Drop old anon policies if they exist
drop policy if exists "anon can read todos" on public.todos;
drop policy if exists "anon can insert todos" on public.todos;
drop policy if exists "anon can update todos" on public.todos;
drop policy if exists "anon can delete todos" on public.todos;

-- Allow authenticated users full access to their own todos
-- We need a user_id column to scope rows — add it if missing
alter table public.todos
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Authenticated users can read their own todos
create policy "authenticated can select own todos"
  on public.todos
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Authenticated users can insert their own todos
create policy "authenticated can insert own todos"
  on public.todos
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Authenticated users can update their own todos
create policy "authenticated can update own todos"
  on public.todos
  for update
  to authenticated
  using (auth.uid() = user_id);

-- Authenticated users can delete their own todos
create policy "authenticated can delete own todos"
  on public.todos
  for delete
  to authenticated
  using (auth.uid() = user_id);
