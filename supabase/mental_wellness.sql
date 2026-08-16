-- Adds mental wellness check-ins: a daily mood + journal log, private per
-- user, plus an optional AI reflection that reuses the existing ask-claude
-- proxy and freemium quota (mood logging itself is always free — only the
-- AI reflection counts as an AI action, same as every other AI feature).
-- Run this in the Supabase SQL Editor.

create table if not exists mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  mood int not null check (mood between 1 and 5),
  notes text default '',
  ai_reflection text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table mood_logs enable row level security;

drop policy if exists "Users manage their own mood logs" on mood_logs;
create policy "Users manage their own mood logs"
  on mood_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists mood_logs_set_updated_at on mood_logs;
create trigger mood_logs_set_updated_at
  before update on mood_logs
  for each row execute function set_updated_at();

grant select, insert, update, delete on mood_logs to authenticated;

-- Let mood_reflection AI replies count toward the freemium limit and show
-- up in History, same as every other AI feature (coach_chat, food_scan, etc).
alter table ai_history drop constraint if exists ai_history_kind_check;

alter table ai_history add constraint ai_history_kind_check
  check (kind in (
    'equipment_scan',
    'food_scan',
    'nutrition_search',
    'exercise_explanation',
    'coach_chat',
    'mood_reflection'
  ));
