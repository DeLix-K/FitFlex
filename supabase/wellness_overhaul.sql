-- ─────────────────────────────────────────────
-- Wellness tab overhaul: mostly client-side/UI (breathwork modes, the
-- grounding tool, binaural beats, tip carousel, and the workout-to-hydration
-- habit stack are all computed from data already in the schema), so this
-- migration only adds the one genuinely new AI history kind for the
-- Premium personalized recommendation -- distinct from mood_reflection,
-- which reflects on one specific journal entry rather than the day's
-- aggregate readiness signals.
-- ─────────────────────────────────────────────
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
    'bedtime_story',
    'wellness_recommendation'
  ));
