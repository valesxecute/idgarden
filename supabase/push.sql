-- Idea Garden: push reminders (Phase 8). Run once in Supabase → SQL Editor,
-- after replacing <CRON_SECRET> below with the same value as the garden-remind CRON_SECRET secret.

create table if not exists public.push_subs (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  tz_offset  int  not null default 0, -- minutes east of UTC, so reminders arrive ~9:00 local
  last_sent  timestamptz,
  created_at timestamptz not null default now()
);

alter table public.push_subs enable row level security;
drop policy if exists "own push subs" on public.push_subs;
create policy "own push subs" on public.push_subs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- hourly tick; garden-remind only sends where it's 9:00 local and nothing went out in the last 3 days
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('garden-remind') where exists (select 1 from cron.job where jobname = 'garden-remind');
select cron.schedule('garden-remind', '2 * * * *', $$
  select net.http_post(
    url := 'https://norkkufzahqbbntppmrr.supabase.co/functions/v1/garden-remind',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  )
$$);
