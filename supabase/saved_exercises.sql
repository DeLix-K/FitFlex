-- Lets users bookmark exercises ("Save exercise" from the spec), private
-- per user -- same simple pattern as every other user-owned join table.

create table if not exists saved_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

alter table saved_exercises enable row level security;

drop policy if exists "Users manage their own saved exercises" on saved_exercises;
create policy "Users manage their own saved exercises"
  on saved_exercises for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, delete on saved_exercises to authenticated;
