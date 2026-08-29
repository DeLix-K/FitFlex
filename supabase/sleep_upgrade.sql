-- ─────────────────────────────────────────────
-- Sleep tab overhaul: sleep goals (for wind-down/bedtime guidance and the
-- best-effort wake notification), real biometric fields pulled from Oura
-- (average_hrv/lowest_heart_rate/sleep_phase_5min -- never fabricated,
-- only ever populated for source = 'oura'), and behavior tagging so users
-- can correlate real daytime habits with their real sleep outcomes.
-- Run this against the linked project: same pattern as every other
-- *_upgrade.sql this session (idempotent, safe to re-run).
-- ─────────────────────────────────────────────

alter table profiles add column if not exists sleep_goal_hours numeric not null default 8
  check (sleep_goal_hours between 4 and 12);
alter table profiles add column if not exists target_wake_time time not null default '07:00';

-- profiles.update is a column-scoped grant (see schema.sql) so users can only
-- ever touch specific columns on their own row -- extend the exact list
-- rather than granting a blanket update, which would also expose
-- is_premium/is_admin/stripe_* to client writes.
grant update (sleep_goal_hours, target_wake_time) on profiles to authenticated;

-- Stage breakdown already existed (deep/rem/light/awake); these three are
-- the additional real Oura fields needed for the readiness bar charts and
-- the hypnogram graph. sleep_logs already has a full authenticated update
-- grant (schema.sql), so no grant change needed here.
alter table sleep_logs add column if not exists average_hrv int;
alter table sleep_logs add column if not exists lowest_heart_rate int;
-- Oura's per-5-minute stage string for the night: each character is one
-- 5-minute period -- '1' deep, '2' light, '3' rem, '4' awake (per Oura API
-- v2 docs). Only ever populated for source = 'oura'.
alter table sleep_logs add column if not exists sleep_phase_5min text;

-- ─────────────────────────────────────────────
-- One-tap behavior tagging: "what affected your sleep last night" -- a
-- fixed, honest list of self-reported daytime habits, not inferred or
-- guessed from any other data source.
-- ─────────────────────────────────────────────
create table if not exists sleep_behavior_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sleep_date date not null,
  tag text not null check (tag in (
    'alcohol', 'late_meal', 'caffeine_late', 'sauna_bath',
    'screen_time', 'stressful_day', 'meditated', 'magnesium', 'intense_exercise'
  )),
  created_at timestamptz not null default now(),
  unique (user_id, sleep_date, tag)
);

alter table sleep_behavior_tags enable row level security;

drop policy if exists "Users manage their own sleep behavior tags" on sleep_behavior_tags;
create policy "Users manage their own sleep behavior tags"
  on sleep_behavior_tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- update is needed even though rows are never edited in place: the client
-- upserts (insert ... on conflict do update), and Postgres requires UPDATE
-- privilege on the table for the conflict-update path, not just INSERT.
-- (Same class of bug as challenge_participants in the Challenges overhaul
-- -- caught this time before shipping instead of after.)
grant select, insert, update, delete on sleep_behavior_tags to authenticated;

-- One more AI history kind for the Recovery Hub's AI-narrated bedtime
-- stories, same drop/recreate pattern as every previous kind addition.
alter table ai_history drop constraint if exists ai_history_kind_check;
alter table ai_history add constraint ai_history_kind_check
  check (kind in (
    'equipment_scan',
    'food_scan',
    'nutrition_search',
    'exercise_explanation',
    'coach_chat',
    'mood_reflection',
    'sleep_insight',
    'daily_briefing',
    'post_workout_insight',
    'session_recalibration',
    'form_check',
    'bedtime_story'
  ));
