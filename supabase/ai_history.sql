-- Stores past AI scan/search results so users can look back at them.
-- Run this in the Supabase SQL Editor.

create table if not exists ai_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('equipment_scan', 'food_scan', 'nutrition_search')),
  query text,
  result text not null,
  created_at timestamptz not null default now()
);

alter table ai_history enable row level security;

create policy "Users manage their own AI history"
  on ai_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on ai_history to authenticated;
