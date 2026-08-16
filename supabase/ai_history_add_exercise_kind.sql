-- Adds 'exercise_explanation' as a valid ai_history.kind, so AI exercise
-- explanations (from the Exercises tab) get saved to History too, not just
-- scans and nutrition searches.
-- Run this in the Supabase SQL Editor.

alter table ai_history drop constraint if exists ai_history_kind_check;

alter table ai_history add constraint ai_history_kind_check
  check (kind in ('equipment_scan', 'food_scan', 'nutrition_search', 'exercise_explanation'));
