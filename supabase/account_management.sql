-- Adds: (1) a fix for a real bug — trainer_orders.trainer_profile_id used
-- "on delete restrict", which would permanently block a trainer from
-- deleting their own account once they'd received any order; (2) optional
-- body-stat fields on profiles, used to compute personalized daily calorie
-- and protein targets (client-side arithmetic, no new table needed); (3)
-- grants for the delete-account Edge Function.
-- Run this in the Supabase SQL Editor.

-- ─────────────────────────────────────────────
-- Fix: a trainer's own order history is tied to their trainer identity —
-- if they delete their account, cascading those order records away is the
-- right behavior (the actual delivered workout_plans stay with the client
-- independently, since workout_plans.user_id cascades off the CLIENT's
-- account, not the trainer's).
-- ─────────────────────────────────────────────
alter table trainer_orders drop constraint if exists trainer_orders_trainer_profile_id_fkey;
alter table trainer_orders
  add constraint trainer_orders_trainer_profile_id_fkey
  foreign key (trainer_profile_id) references trainer_profiles(id) on delete cascade;

-- ─────────────────────────────────────────────
-- Body stats: optional, used only to compute calorie/protein targets
-- client-side. Same column-scoped grant pattern as display_name — users can
-- only ever update these specific columns on their own row, never is_premium
-- or anything else, even if the RLS-permitted row is theirs.
-- ─────────────────────────────────────────────
alter table profiles
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric,
  add column if not exists age int,
  add column if not exists sex text check (sex in ('male', 'female')),
  add column if not exists activity_level text
    check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  add column if not exists goal text check (goal in ('lose', 'maintain', 'gain'));

grant update (height_cm, weight_kg, age, sex, activity_level, goal) on profiles to authenticated;
