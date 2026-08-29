-- ─────────────────────────────────────────────
-- Exercises tab overhaul: real per-set logging (so PR/volume/1RM history is
-- genuine, not fabricated), plus two small new classification columns
-- (systemic fatigue tier, joint-friendliness) backfilled by hand for the
-- current small catalog using standard, well-established exercise-science
-- classifications -- same trust level as the existing instructions/
-- benefits text, which was written the same way originally.
--
-- Primary vs secondary muscle badges and antagonist-superset pairing need
-- NO schema change: muscle_groups is already ordered primary-first in
-- every existing row (verified against all 6 rows before writing this),
-- so lib/exercises.ts treats muscle_groups[0] as primary and the rest as
-- secondary/stabilizers. Equipment-based substitution also needs no new
-- column -- it filters the existing equipment/muscle_groups arrays.
-- Visual form-demo GIFs/Lottie animations were explicitly deferred (no
-- real content exists, and a fabricated movement demo risks silently
-- showing incorrect, injury-risk-adjacent form) -- flagged as a separate
-- future project, same treatment as the deferred live-camera form check.
-- ─────────────────────────────────────────────

alter table exercises add column if not exists fatigue_tier text check (fatigue_tier in ('low', 'moderate', 'high'));
alter table exercises add column if not exists low_impact boolean not null default false;

update exercises set fatigue_tier = 'high', low_impact = false where name = 'Deadlift';
update exercises set fatigue_tier = 'moderate', low_impact = false where name = 'Bench Press';
update exercises set fatigue_tier = 'moderate', low_impact = false where name = 'Pull-Up';
update exercises set fatigue_tier = 'low', low_impact = true where name = 'Push-Up';
update exercises set fatigue_tier = 'low', low_impact = true where name = 'Bodyweight Squat';
update exercises set fatigue_tier = 'moderate', low_impact = false where name = 'Running';

-- ─────────────────────────────────────────────
-- Real per-set logging: the actual new capability behind honest PR/volume/
-- estimated-1RM history (Epley formula, computed client-side, never
-- fabricated). A user can only ever see/write their own sets.
-- ─────────────────────────────────────────────
create table if not exists exercise_set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  logged_date date not null default current_date,
  weight numeric not null check (weight >= 0),
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  reps int not null check (reps between 1 and 100),
  created_at timestamptz not null default now()
);

alter table exercise_set_logs enable row level security;

drop policy if exists "Users manage their own exercise set logs" on exercise_set_logs;
create policy "Users manage their own exercise set logs"
  on exercise_set_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on exercise_set_logs to authenticated;

create index if not exists exercise_set_logs_user_exercise_idx
  on exercise_set_logs (user_id, exercise_id, logged_date desc);

-- ─────────────────────────────────────────────
-- Custom exercises: the spec's "Custom Exercises" tab needs a real data
-- source, not just a UI label with nothing behind it -- users can add their
-- own private exercise entries alongside the shared official catalog.
-- Reuses the exact ownership-RLS pattern already used everywhere else in
-- this app (habits, mood_logs, etc). A custom row is visible only to its
-- creator, never merged into the shared catalog other users see.
-- ─────────────────────────────────────────────
alter table exercises add column if not exists created_by uuid references auth.users(id) on delete cascade;

drop policy if exists "Exercises are readable by anyone" on exercises;
create policy "Exercises are readable by anyone or own custom"
  on exercises for select
  using (created_by is null or created_by = auth.uid());

drop policy if exists "Users manage their own custom exercises" on exercises;
create policy "Users manage their own custom exercises"
  on exercises for insert
  with check (created_by = auth.uid());

drop policy if exists "Users delete their own custom exercises" on exercises;
create policy "Users delete their own custom exercises"
  on exercises for delete
  using (created_by = auth.uid());

grant insert, delete on exercises to authenticated;
