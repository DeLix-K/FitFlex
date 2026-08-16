-- Adds 'coach_chat' as a valid ai_history.kind, so AI Coach conversations
-- (from the new Coach tab) count toward the same daily free-AI-actions limit
-- and show up in History alongside scans/searches.
-- Run this in the Supabase SQL Editor.

alter table ai_history drop constraint if exists ai_history_kind_check;

alter table ai_history add constraint ai_history_kind_check
  check (kind in (
    'equipment_scan',
    'food_scan',
    'nutrition_search',
    'exercise_explanation',
    'coach_chat'
  ));
