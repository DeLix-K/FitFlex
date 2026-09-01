-- GPS-tracked outdoor activities (run/walk/ride): real distance, duration,
-- pace, and route saved from expo-location's foreground GPS watch. Standard
-- per-user ownership RLS, same pattern as sleep_logs/mood entries -- no
-- Edge Function needed, this never touches anything admin-only.
-- Run this in the Supabase SQL Editor.

create table if not exists outdoor_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('run', 'walk', 'ride')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  distance_meters numeric not null default 0,
  duration_seconds int not null default 0,
  -- Array of {lat, lng, t} points in chronological order. Simple JSONB, not
  -- PostGIS -- this app has no geospatial querying needs yet (no "find
  -- routes near me"), just storing and redrawing one user's own route.
  route jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table outdoor_activities enable row level security;

drop policy if exists "Users manage their own outdoor activities" on outdoor_activities;
create policy "Users manage their own outdoor activities"
  on outdoor_activities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on outdoor_activities to authenticated;
