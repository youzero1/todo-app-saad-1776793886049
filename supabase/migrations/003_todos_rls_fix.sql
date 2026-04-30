-- Fix RLS: drop any conflicting policies and recreate with DEFAULT auth.uid()
-- so inserts without explicit user_id still pass the WITH CHECK.

-- Drop all existing policies on todos (covers any name variants)
drop policy if exists "authenticated can select own todos" on public.todos;
drop policy if exists "authenticated can insert own todos" on public.todos;
drop policy if exists "authenticated can update own todos" on public.todos;
drop policy if exists "authenticated can delete own todos" on public.todos;
drop policy if exists "anon can read todos" on public.todos;
drop policy if exists "anon can insert todos" on public.todos;
drop policy if exists "anon can update todos" on public.todos;
drop policy if exists "anon can delete todos" on public.todos;

-- Ensure user_id column exists
alter table public.todos
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Set DEFAULT so INSERT without explicit user_id automatically fills it
alter table public.todos
  alter column user_id set default auth.uid();

-- Make sure RLS is enabled
alter table public.todos enable row level security;

-- SELECT: authenticated users see only their own todos
create policy "todos_select_own"
  on public.todos
  for select
  to authenticated
  using (auth.uid() = user_id);

-- INSERT: user_id default means auth.uid() is set automatically;
-- WITH CHECK allows both explicit and defaulted user_id
create policy "todos_insert_own"
  on public.todos
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- UPDATE: authenticated users can only update their own todos
create policy "todos_update_own"
  on public.todos
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: authenticated users can only delete their own todos
create policy "todos_delete_own"
  on public.todos
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Backfill: any existing rows with NULL user_id cannot be seen under RLS.
-- They are orphaned. Delete them to keep the table clean.
delete from public.todos where user_id is null;
