-- AI Coach upgrade: selectable coach personality, plus new ai_history kinds
-- for the Daily Briefing, post-workout insight, session recalibration, and
-- photo-based form check features.
-- ─────────────────────────────────────────────
alter table profiles add column if not exists coach_personality text not null default 'encouraging';

alter table profiles drop constraint if exists profiles_coach_personality_check;
alter table profiles add constraint profiles_coach_personality_check
  check (coach_personality in ('encouraging', 'strict', 'data_focused'));

-- Same column-scoped grant pattern as display_name -- a user can only ever
-- touch this one column on their own row via RLS's existing update policy.
grant update (coach_personality) on profiles to authenticated;

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
    'form_check'
  ));
