-- Adds 'sleep_insight' as a valid ai_history.kind, for the new "Get AI
-- Insight" button on the redesigned Sleep screen -- same daily free-AI-
-- actions limit and History listing as every other AI feature.
-- Run this in the Supabase SQL Editor.

alter table ai_history drop constraint if exists ai_history_kind_check;

alter table ai_history add constraint ai_history_kind_check
  check (kind in (
    'equipment_scan',
    'food_scan',
    'nutrition_search',
    'exercise_explanation',
    'coach_chat',
    'mood_reflection',
    'sleep_insight'
  ));
