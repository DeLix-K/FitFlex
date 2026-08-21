-- Expands the Wellness screen with real, self-reportable dimensions
-- (stress, energy) alongside mood, plus a simple hydration counter --
-- for the redesigned Wellness screen's spec sections. Mindfulness/
-- breathing are handled purely client-side (a timer, no data to store);
-- Recovery reuses the real Oura readiness score already added for
-- Wearables rather than inventing a new one.

alter table mood_logs
  add column if not exists stress int check (stress between 1 and 5),
  add column if not exists energy int check (energy between 1 and 5);

create table if not exists hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  glasses int not null default 0 check (glasses >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table hydration_logs enable row level security;

drop policy if exists "Users manage their own hydration logs" on hydration_logs;
create policy "Users manage their own hydration logs"
  on hydration_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists hydration_logs_set_updated_at on hydration_logs;
create trigger hydration_logs_set_updated_at
  before update on hydration_logs
  for each row execute function set_updated_at();

grant select, insert, update, delete on hydration_logs to authenticated;
