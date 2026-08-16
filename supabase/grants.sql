-- Run this in the Supabase SQL Editor (same place you ran schema.sql).
-- Grants the anon/authenticated roles permission to actually use the tables.
-- (Row Level Security policies still control which specific rows they can see/change.)

grant usage on schema public to anon, authenticated;

grant select on exercises to anon, authenticated;

grant select, insert, update, delete on workout_plans to authenticated;

grant select, insert, update, delete on workout_plan_exercises to authenticated;
