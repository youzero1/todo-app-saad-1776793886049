-- Create todos table
create table if not exists public.todos (
  id bigint generated always as identity primary key,
  text text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.todos enable row level security;

-- Allow anonymous users to read all todos
create policy "anon can read todos"
  on public.todos
  for select
  to anon
  using (true);

-- Allow anonymous users to insert todos
create policy "anon can insert todos"
  on public.todos
  for insert
  to anon
  with check (true);

-- Allow anonymous users to update todos
create policy "anon can update todos"
  on public.todos
  for update
  to anon
  using (true);

-- Allow anonymous users to delete todos
create policy "anon can delete todos"
  on public.todos
  for delete
  to anon
  using (true);
