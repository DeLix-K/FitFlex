-- Adds workout logging (for streaks) and a leaderboard.
-- Run this in the Supabase SQL Editor.

-- ─────────────────────────────────────────────
-- Display name: shown on the leaderboard instead of email (privacy).
-- Users may update ONLY this column on their own profile — the column-level
-- grant means even if the RLS policy allows the row, Postgres still blocks
-- an update that touches is_premium or anything else in the same statement.
-- ─────────────────────────────────────────────
alter table profiles add column if not exists display_name text;

drop policy if exists "Users can update their own display name" on profiles;
create policy "Users can update their own display name"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant update (display_name) on profiles to authenticated;

-- ─────────────────────────────────────────────
-- Workout logs: one row per day a user logs activity. Private per user,
-- same RLS pattern as everything else.
-- ─────────────────────────────────────────────
create table if not exists workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_date date not null default current_date,
  workout_plan_id uuid references workout_plans(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, logged_date)
);

alter table workout_logs enable row level security;

drop policy if exists "Users manage their own workout logs" on workout_logs;
create policy "Users manage their own workout logs"
  on workout_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on workout_logs to authenticated;

-- ─────────────────────────────────────────────
-- Streak calculation: classic "islands of consecutive dates" pattern.
-- A streak counts as still "current" if the last logged day was today or
-- yesterday (a one-day grace period, like most streak-tracking apps).
-- ─────────────────────────────────────────────
create or replace view user_streaks
with (security_invoker = false) as
with islands as (
  select
    user_id,
    logged_date,
    logged_date - (row_number() over (partition by user_id order by logged_date))::integer as island_id
  from workout_logs
),
grouped as (
  select user_id, island_id, max(logged_date) as last_day, count(*) as streak_length
  from islands
  group by user_id, island_id
),
latest as (
  select distinct on (user_id) user_id, last_day, streak_length
  from grouped
  order by user_id, last_day desc
)
select
  user_id,
  case when last_day >= current_date - 1 then streak_length else 0 end as current_streak
from latest;

-- ─────────────────────────────────────────────
-- Leaderboard: only exposes display name + aggregate stats, never raw logs
-- or emails. The view runs with the owner's privileges (security_invoker =
-- false, the Postgres default), so it can read across all users' data while
-- the underlying tables stay fully RLS-locked to direct queries.
-- ─────────────────────────────────────────────
create or replace view leaderboard
with (security_invoker = false) as
select
  p.id as user_id,
  coalesce(nullif(p.display_name, ''), 'Fitness Fan') as display_name,
  coalesce(s.current_streak, 0) as current_streak,
  coalesce(t.total_workouts, 0) as total_workouts
from profiles p
left join user_streaks s on s.user_id = p.id
left join (
  select user_id, count(distinct logged_date) as total_workouts
  from workout_logs
  group by user_id
) t on t.user_id = p.id;

grant select on leaderboard to authenticated;
