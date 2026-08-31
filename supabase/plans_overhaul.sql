-- ─────────────────────────────────────────────
-- My Plans tab overhaul: turns flat plan CRUD into a real program system.
--
-- `workout_plans` gains purely cosmetic customization (theme + emoji) --
-- no fabrication risk, just ownership/identity like the reference spec's
-- "Dynamic Card Themes" asked for.
--
-- `programs` is a NEW, OPTIONAL grouping layer above individual plans, so
-- a real "4-Day Push/Pull/Legs" program can be built from 3 separate
-- existing workout_plans rotated together, with REAL (not fabricated)
-- week/session progress computed from `start_date` + actual completions
-- in `workout_logs` -- never a made-up "Week 3 of 8 (80%)" placeholder.
-- Existing standalone plans + plan_schedule keep working completely
-- unchanged for anyone not using programs.
--
-- `schedule_mode`:
--   'weekday'  -- classic calendar days (current plan_schedule behavior,
--                 unaffected), "Week N of duration_weeks" computed from
--                 start_date.
--   'flexible' -- the spec's "Session 1 / Session 2" differentiator: no
--                 calendar days at all, next session = (real completed
--                 session count for this program) % (number of sessions),
--                 so a missed day just shifts the rotation instead of
--                 producing "missed day" guilt.
--
-- Deload weeks are pure date math (every `deload_interval_weeks`-th week
-- is flagged), NOT AI/plateau-detected -- real plateau detection from
-- exercise_set_logs trends was explicitly deferred to a future project.
-- ─────────────────────────────────────────────

alter table workout_plans add column if not exists theme_key text not null default 'neon'
  check (theme_key in ('neon', 'charcoal', 'gold', 'crimson', 'azure'));
alter table workout_plans add column if not exists emoji text;

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  theme_key text not null default 'neon'
    check (theme_key in ('neon', 'charcoal', 'gold', 'crimson', 'azure')),
  emoji text,
  duration_weeks int check (duration_weeks is null or duration_weeks between 1 and 52),
  start_date date,
  deload_interval_weeks int check (deload_interval_weeks is null or deload_interval_weeks between 2 and 12),
  schedule_mode text not null default 'weekday' check (schedule_mode in ('weekday', 'flexible')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table programs enable row level security;

drop policy if exists "Users manage their own programs" on programs;
create policy "Users manage their own programs"
  on programs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on programs to authenticated;

drop trigger if exists programs_set_updated_at on programs;
create trigger programs_set_updated_at
  before update on programs
  for each row execute function set_updated_at();

-- Which workout_plans belong to a program, and in what order/weekday.
-- weekday is used only in 'weekday' mode; order_index drives the rotation
-- in 'flexible' mode (and is also just display order in 'weekday' mode).
create table if not exists program_plans (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  plan_id uuid not null references workout_plans(id) on delete cascade,
  order_index int not null default 0,
  weekday int check (weekday between 0 and 6),
  created_at timestamptz not null default now()
);

alter table program_plans enable row level security;

drop policy if exists "Users manage their own program plans" on program_plans;
create policy "Users manage their own program plans"
  on program_plans for all
  using (exists (select 1 from programs p where p.id = program_plans.program_id and p.user_id = auth.uid()))
  with check (exists (select 1 from programs p where p.id = program_plans.program_id and p.user_id = auth.uid()));

grant select, insert, update, delete on program_plans to authenticated;

create index if not exists program_plans_program_idx on program_plans (program_id, order_index);
create unique index if not exists program_plans_weekday_uidx on program_plans (program_id, weekday) where weekday is not null;

-- Tie a completion to the specific program it was done for. A plan can be
-- reused standalone or across programs, so this can't be reconstructed
-- after the fact -- record it at logging time. Nullable: general workout
-- logging (e.g. from the Streaks tab) keeps working exactly as before.
alter table workout_logs add column if not exists program_id uuid references programs(id) on delete set null;
