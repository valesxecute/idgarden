-- Idea Garden: run once in Supabase → SQL Editor.
-- One row per user holding their whole garden as JSON (prototype sync model).

create table if not exists public.gardens (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.gardens enable row level security;

drop policy if exists "read own garden"   on public.gardens;
drop policy if exists "insert own garden" on public.gardens;
drop policy if exists "update own garden" on public.gardens;
drop policy if exists "delete own garden" on public.gardens;

create policy "read own garden"   on public.gardens for select using (auth.uid() = user_id);
create policy "insert own garden" on public.gardens for insert with check (auth.uid() = user_id);
create policy "update own garden" on public.gardens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own garden" on public.gardens for delete using (auth.uid() = user_id);

-- live updates to your other open devices
do $$ begin
  alter publication supabase_realtime add table public.gardens;
exception when duplicate_object then null; end $$;
