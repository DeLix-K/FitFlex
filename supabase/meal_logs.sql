-- Real meal logging, needed by both Scan Food ("Add to Today's Meals")
-- and the Nutrition dashboard (daily kcal/macro totals by meal). Numbers
-- are always user-entered (manually, or copied in after reading the AI
-- scan estimate) -- there's no auto-fill from the scan's free-text AI
-- reply, so "add to meals" doubles as the spec's "allow the user to
-- correct the AI estimate."

create table if not exists meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  description text not null default '',
  calories int not null default 0 check (calories >= 0),
  protein_g numeric not null default 0 check (protein_g >= 0),
  carbs_g numeric not null default 0 check (carbs_g >= 0),
  fat_g numeric not null default 0 check (fat_g >= 0),
  source text not null default 'manual' check (source in ('manual', 'scan', 'search')),
  created_at timestamptz not null default now()
);

alter table meal_logs enable row level security;

drop policy if exists "Users manage their own meal logs" on meal_logs;
create policy "Users manage their own meal logs"
  on meal_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on meal_logs to authenticated;
