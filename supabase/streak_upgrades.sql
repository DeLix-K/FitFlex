-- Streaks tab upgrade: weekly targets, streak freezes, real duration/volume
-- stats. Everything here is derived from genuinely logged data -- the only
-- estimate is calories burned, which is clearly labeled as such (MET-based,
-- same honesty pattern as the food-scan calorie estimates elsewhere).
-- ─────────────────────────────────────────────

-- Weekly target: how many days/week the user is aiming for. Same
-- column-scoped self-service grant pattern as display_name/coach_personality.
alter table profiles add column if not exists weekly_workout_target int not null default 5;
alter table profiles drop constraint if exists profiles_weekly_workout_target_check;
alter table profiles add constraint profiles_weekly_workout_target_check
  check (weekly_workout_target between 1 and 7);
grant update (weekly_workout_target) on profiles to authenticated;

-- Optional session duration, entered by the user when they log a workout.
-- Powers "Total Minutes Active" and the calorie estimate; null is a normal,
-- honest state for a day logged without a duration.
alter table workout_logs add column if not exists duration_minutes int;
alter table workout_logs drop constraint if exists workout_logs_duration_minutes_check;
alter table workout_logs add constraint workout_logs_duration_minutes_check
  check (duration_minutes is null or duration_minutes between 1 and 600);

-- ─────────────────────────────────────────────
-- Streak freezes: a small, low-stakes gamification wallet, not a security
-- boundary -- but writes still go through SECURITY DEFINER functions below
-- (not direct client table writes) so a user can't just set their own
-- balance to an arbitrary number via a raw REST call. Earned automatically
-- every 7-day streak milestone (capped at 5 banked); Premium subscribers
-- always have at least 2 available as a subscription perk ("or buy" from
-- the spec, satisfied via the existing subscription rather than a separate
-- one-time purchase flow).
-- ─────────────────────────────────────────────
create table if not exists streak_freezes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  highest_rewarded_streak int not null default 0,
  updated_at timestamptz not null default now()
);

alter table streak_freezes enable row level security;

drop policy if exists "Users can view their own streak freeze balance" on streak_freezes;
create policy "Users can view their own streak freeze balance"
  on streak_freezes for select
  using (auth.uid() = user_id);

grant select on streak_freezes to authenticated;

-- Immutable log of which missed days were covered by a freeze. No
-- update/delete -- like trainer_messages, a use is a permanent fact once it
-- happens.
create table if not exists streak_freeze_uses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  covered_date date not null,
  used_at timestamptz not null default now(),
  unique (user_id, covered_date)
);

alter table streak_freeze_uses enable row level security;

drop policy if exists "Users can view their own streak freeze uses" on streak_freeze_uses;
create policy "Users can view their own streak freeze uses"
  on streak_freeze_uses for select
  using (auth.uid() = user_id);

grant select on streak_freeze_uses to authenticated;

-- Recomputes the caller's REAL current streak from user_streaks (never
-- trusts a client-supplied number) and grants +1 freeze per new 7-day
-- milestone crossed since the last grant, capped at 5 banked. Also tops up
-- Premium subscribers to a floor of 2. Call this whenever the Streaks
-- screen loads or right after logging a workout.
create or replace function grant_streak_freeze_if_earned()
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
  v_is_premium boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select current_streak into v_current_streak from user_streaks where user_id = v_user_id;
  v_current_streak := coalesce(v_current_streak, 0);

  insert into streak_freezes (user_id) values (v_user_id)
    on conflict (user_id) do nothing;

  select highest_rewarded_streak into v_highest
    from streak_freezes where user_id = v_user_id for update;

  v_new_milestones := floor(v_current_streak::numeric / 7) - floor(v_highest::numeric / 7);

  if v_new_milestones > 0 then
    update streak_freezes
      set balance = least(balance + v_new_milestones, 5),
          highest_rewarded_streak = v_current_streak,
          updated_at = now()
      where user_id = v_user_id;
  end if;

  select is_premium into v_is_premium from profiles where id = v_user_id;
  if v_is_premium then
    update streak_freezes
      set balance = 2, updated_at = now()
      where user_id = v_user_id and balance < 2;
  end if;

  return (select balance from streak_freezes where user_id = v_user_id);
end;
$$;

grant execute on function grant_streak_freeze_if_earned() to authenticated;

-- Spends one freeze (if available) to cover a specific missed date, atomic
-- against double-spending the same date or an empty balance.
create or replace function use_streak_freeze(p_covered_date date)
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

  insert into streak_freeze_uses (user_id, covered_date)
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

grant execute on function use_streak_freeze(date) to authenticated;

-- ─────────────────────────────────────────────
-- Make a freeze-covered date bridge the streak gap the same way a real
-- logged workout would, without counting as one. Only the islands
-- (gap-detection) input changes; total_workouts below and everywhere else
-- still counts real workout_logs rows only.
-- ─────────────────────────────────────────────
create or replace view user_streaks
with (security_invoker = false) as
with active_dates as (
  select user_id, logged_date from workout_logs
  union
  select user_id, covered_date as logged_date from streak_freeze_uses
),
islands as (
  select
    user_id,
    logged_date,
    logged_date - (row_number() over (partition by user_id order by logged_date))::integer as island_id
  from active_dates
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
  longest.longest_streak
from latest
join longest on longest.user_id = latest.user_id;
