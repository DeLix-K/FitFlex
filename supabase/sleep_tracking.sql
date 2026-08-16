-- Adds sleep tracking: manual nightly logging for everyone, plus automatic
-- sync from Oura for users who've connected it (Oura data takes precedence
-- over a manual entry for the same night when both exist).
-- Run this in the Supabase SQL Editor.

create table if not exists sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sleep_date date not null,
  duration_minutes int,
  bedtime timestamptz,
  wake_time timestamptz,
  quality_rating int check (quality_rating between 1 and 5),
  sleep_score int check (sleep_score between 0 and 100),
  notes text default '',
  source text not null default 'manual' check (source in ('manual', 'oura')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sleep_date)
);

alter table sleep_logs enable row level security;

drop policy if exists "Users manage their own sleep logs" on sleep_logs;
create policy "Users manage their own sleep logs"
  on sleep_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Reuses the same set_updated_at() trigger function already defined for
-- workout_plans.
drop trigger if exists sleep_logs_set_updated_at on sleep_logs;
create trigger sleep_logs_set_updated_at
  before update on sleep_logs
  for each row execute function set_updated_at();

grant select, insert, update, delete on sleep_logs to authenticated;
-- The oura-sleep-sync Edge Function upserts on behalf of the verified
-- caller using the service role (same pattern as every other Oura
-- function) since it needs to write regardless of which specific dates
-- already have rows.
grant select, insert, update on sleep_logs to service_role;
