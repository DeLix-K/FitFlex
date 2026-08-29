-- ─────────────────────────────────────────────
-- Habit Hub overhaul: target-tier habits (not just yes/no), time-of-day
-- grouping, auto-completion from data this app already tracks for real
-- (sleep duration, a logged workout, Oura steps -- never a fabricated
-- sensor), and a forgiving "Health Momentum" streak that shares the SAME
-- freeze wallet already built for the Streaks tab (streak_freezes),
-- consistent with how Challenge shields also spend from that one wallet.
-- ─────────────────────────────────────────────

alter table habits add column if not exists habit_type text not null default 'boolean'
  check (habit_type in ('boolean', 'numeric'));
-- For a numeric habit, the daily target (e.g. 2000 for "2000 ml water").
-- For an auto-synced habit, this doubles as the auto-complete threshold
-- (e.g. 420 minutes of sleep, 8000 steps) -- one column, one meaning.
alter table habits add column if not exists target_value numeric check (target_value is null or target_value > 0);
alter table habits add column if not exists unit text;
alter table habits add column if not exists time_of_day text not null default 'anytime'
  check (time_of_day in ('morning', 'midday', 'evening', 'anytime'));
-- Only ever set for a habit backed by data this app already has for real --
-- never a placeholder for a sensor that isn't actually wired up.
alter table habits add column if not exists auto_sync_source text
  check (auto_sync_source in ('sleep_duration', 'oura_steps', 'workout_done'));

alter table habit_logs add column if not exists progress_value numeric check (progress_value is null or progress_value >= 0);
alter table habit_logs add column if not exists source text not null default 'manual' check (source in ('manual', 'auto'));

-- ─────────────────────────────────────────────
-- Immutable log of which missed habit days were covered by a freeze.
-- Created before habit_momentum below since the view reads from it.
-- ─────────────────────────────────────────────
create table if not exists habit_freeze_uses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  covered_date date not null,
  used_at timestamptz not null default now(),
  unique (user_id, covered_date)
);

alter table habit_freeze_uses enable row level security;

drop policy if exists "Users can view their own habit freeze uses" on habit_freeze_uses;
create policy "Users can view their own habit freeze uses"
  on habit_freeze_uses for select
  using (auth.uid() = user_id);

grant select on habit_freeze_uses to authenticated;

-- Tracks habit-momentum reward milestones independently from the
-- workout-streak's highest_rewarded_streak column, while both deposit into
-- the SAME shared balance.
alter table streak_freezes add column if not exists highest_rewarded_habit_momentum int not null default 0;

-- ─────────────────────────────────────────────
-- Health Momentum: a single cross-habit streak of "at least one habit
-- logged today", separate from the per-workout streak but sharing the same
-- streak_freezes wallet. Chosen deliberately over "ALL habits completed"
-- since which habits existed on a past date can't be reconstructed once a
-- habit is deleted, and "any real habit logged" is still a genuine,
-- non-fabricated signal of engagement.
-- ─────────────────────────────────────────────
create or replace view habit_momentum
with (security_invoker = true) as
with done_dates as (
  select user_id, logged_date
  from habit_logs
  where progress_value is null
     or progress_value >= (select h.target_value from habits h where h.id = habit_logs.habit_id)
  union
  select user_id, covered_date as logged_date from habit_freeze_uses
),
islands as (
  select
    user_id,
    logged_date,
    logged_date - (row_number() over (partition by user_id order by logged_date))::integer as island_id
  from done_dates
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

grant select on habit_momentum to authenticated;

create or replace function grant_habit_freeze_if_earned()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_streak int;
  v_highest int;
  v_new_milestones int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select current_streak into v_current_streak from habit_momentum where user_id = v_user_id;
  v_current_streak := coalesce(v_current_streak, 0);

  insert into streak_freezes (user_id) values (v_user_id)
    on conflict (user_id) do nothing;

  select highest_rewarded_habit_momentum into v_highest
    from streak_freezes where user_id = v_user_id for update;

  -- Earns faster than the 7-day workout-streak milestone (every 5 days,
  -- per the spec) since habits are meant to be an easier daily ritual.
  v_new_milestones := floor(v_current_streak::numeric / 5) - floor(v_highest::numeric / 5);

  if v_new_milestones > 0 then
    update streak_freezes
      set balance = least(balance + v_new_milestones, 5),
          highest_rewarded_habit_momentum = v_current_streak,
          updated_at = now()
      where user_id = v_user_id;
  end if;

  return (select balance from streak_freezes where user_id = v_user_id);
end;
$$;

grant execute on function grant_habit_freeze_if_earned() to authenticated;

-- Spends one freeze (shared wallet) to cover a missed habit day, atomic
-- against double-spending the same date or an empty balance. Deliberately
-- separate from use_streak_freeze/streak_freeze_uses so a "rest day" on
-- Habits doesn't fabricate a covered workout day, and vice versa.
create or replace function use_habit_freeze(p_covered_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance int;
  v_rows int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select balance into v_balance from streak_freezes where user_id = v_user_id for update;
  if v_balance is null or v_balance < 1 then
    return false;
  end if;

  insert into habit_freeze_uses (user_id, covered_date)
    values (v_user_id, p_covered_date)
    on conflict (user_id, covered_date) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return false;
  end if;

  update streak_freezes set balance = balance - 1, updated_at = now() where user_id = v_user_id;
  return true;
end;
$$;

grant execute on function use_habit_freeze(date) to authenticated;
