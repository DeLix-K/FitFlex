-- A real weekly schedule: which workout plan (if any) a user does on each
-- day of the week. Null plan_id means a rest day. Powers the "My Plans"
-- hero card ("Your Current Plan" / "Start Today's Workout") and the
-- Mon-Sun weekly schedule list from the look-and-feel spec.

create table if not exists plan_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday, matches JS Date#getDay()
  plan_id uuid references workout_plans(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, weekday)
);

alter table plan_schedule enable row level security;

drop policy if exists "Users manage their own plan schedule" on plan_schedule;
create policy "Users manage their own plan schedule"
  on plan_schedule for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists plan_schedule_set_updated_at on plan_schedule;
create trigger plan_schedule_set_updated_at
  before update on plan_schedule
  for each row execute function set_updated_at();

grant select, insert, update, delete on plan_schedule to authenticated;
