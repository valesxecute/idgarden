-- Idea Garden: daily AI usage counter (Phase 6). Run once in Supabase → SQL Editor.
-- The garden-ai Edge Function calls bump_ai_usage() with the signed-in user's token;
-- it returns today's count (null = not signed in), and the function refuses above its daily limit.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default current_date,
  count   int  not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
drop policy if exists "read own ai usage" on public.ai_usage;
create policy "read own ai usage" on public.ai_usage for select using (auth.uid() = user_id);
-- no insert/update policies: only bump_ai_usage() (security definer) can write

create or replace function public.bump_ai_usage() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return null; end if;
  insert into ai_usage (user_id, day, count) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = ai_usage.count + 1
  returning count into n;
  return n;
end $$;

revoke all on function public.bump_ai_usage() from public, anon;
grant execute on function public.bump_ai_usage() to authenticated;
