-- Adds personal habit tracking: user-defined daily habits with a check-off
-- per day and a per-habit streak, same "islands of consecutive dates"
-- pattern already used for the workout streak.
-- Run this in the Supabase SQL Editor.

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table habits enable row level security;

drop policy if exists "Users manage their own habits" on habits;
create policy "Users manage their own habits"
  on habits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (habit_id, logged_date)
);

alter table habit_logs enable row level security;

drop policy if exists "Users manage their own habit logs" on habit_logs;
create policy "Users manage their own habit logs"
  on habit_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Per-habit current streak. Unlike leaderboard/challenge_progress, this view
-- doesn't need to read across users, so security_invoker = true is used
-- instead of the owner-privilege pattern — the view runs with the CALLER's
-- own RLS applied to habit_logs, so it's automatically scoped to only their
-- own habits with no extra filtering needed.
create or replace view habit_streaks
with (security_invoker = true) as
with islands as (
  select
    habit_id,
    logged_date,
    logged_date - (row_number() over (partition by habit_id order by logged_date))::integer as island_id
  from habit_logs
),
grouped as (
  select habit_id, island_id, max(logged_date) as last_day, count(*) as streak_length
  from islands
  group by habit_id, island_id
),
latest as (
  select distinct on (habit_id) habit_id, last_day, streak_length
  from grouped
  order by habit_id, last_day desc
)
select
  habit_id,
  case when last_day >= current_date - 1 then streak_length else 0 end as current_streak
from latest;

grant select, insert, update, delete on habits to authenticated;
grant select, insert, update, delete on habit_logs to authenticated;
grant select on habit_streaks to authenticated;
