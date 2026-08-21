-- Adds longest-streak-ever to user_streaks/leaderboard, for the redesigned
-- Streaks screen ("Look and feel" pass). The existing "current_streak" only
-- ever reflects the latest island; longest_streak is the max island length
-- across all of a user's history, not just the current one.

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
),
longest as (
  select user_id, max(streak_length) as longest_streak
  from grouped
  group by user_id
)
select
  latest.user_id,
  case when latest.last_day >= current_date - 1 then latest.streak_length else 0 end as current_streak,
  longest.longest_streak as longest_streak
from latest
join longest on longest.user_id = latest.user_id;

create or replace view leaderboard
with (security_invoker = false) as
select
  p.id as user_id,
  coalesce(nullif(p.display_name, ''), 'Fitness Fan') as display_name,
  coalesce(s.current_streak, 0) as current_streak,
  coalesce(t.total_workouts, 0) as total_workouts,
  coalesce(s.longest_streak, 0) as longest_streak
from profiles p
left join user_streaks s on s.user_id = p.id
left join (
  select user_id, count(distinct logged_date) as total_workouts
  from workout_logs
  group by user_id
) t on t.user_id = p.id;
