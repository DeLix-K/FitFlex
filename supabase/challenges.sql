-- Adds community challenges: time-boxed goals users can join, with
-- per-challenge progress and a mini leaderboard. Run this in the Supabase
-- SQL Editor.

-- ─────────────────────────────────────────────
-- Challenges: admin-authored, readable by everyone. Same pattern as
-- exercises — anyone can read, only the admin account can create/edit
-- (enforced by RLS, not just app code).
-- ─────────────────────────────────────────────
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  start_date date not null,
  end_date date not null,
  target_workouts int not null,
  created_at timestamptz not null default now()
);

alter table challenges enable row level security;

drop policy if exists "Challenges are readable by anyone" on challenges;
create policy "Challenges are readable by anyone"
  on challenges for select
  using (true);

drop policy if exists "Only the admin can manage challenges" on challenges;
create policy "Only the admin can manage challenges"
  on challenges for all
  using (auth.jwt() ->> 'email' = 'teamlix6@gmail.com')
  with check (auth.jwt() ->> 'email' = 'teamlix6@gmail.com');

grant select on challenges to anon, authenticated;
grant insert, update, delete on challenges to authenticated;

-- ─────────────────────────────────────────────
-- Challenge participants: who joined which challenge. Private-per-user
-- writes (join/leave your own row only) via RLS.
-- ─────────────────────────────────────────────
create table if not exists challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

alter table challenge_participants enable row level security;

drop policy if exists "Users manage their own challenge participation" on challenge_participants;
create policy "Users manage their own challenge participation"
  on challenge_participants for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, delete on challenge_participants to authenticated;

-- ─────────────────────────────────────────────
-- Challenge progress: each participant's workout count within their
-- challenge's date range, plus display name for the mini leaderboard.
-- Runs with the owner's privileges (security_invoker = false) so it can
-- read across all participants' workout_logs while those tables stay
-- fully RLS-locked to direct queries — same pattern as the main leaderboard.
-- ─────────────────────────────────────────────
create or replace view challenge_progress
with (security_invoker = false) as
select
  cp.challenge_id,
  cp.user_id,
  coalesce(nullif(p.display_name, ''), 'Fitness Fan') as display_name,
  cp.joined_at,
  (
    select count(*) from workout_logs wl
    where wl.user_id = cp.user_id
      and wl.logged_date between c.start_date and c.end_date
  ) as workouts_logged
from challenge_participants cp
join challenges c on c.id = cp.challenge_id
join profiles p on p.id = cp.user_id;

grant select on challenge_progress to authenticated;

-- ─────────────────────────────────────────────
-- Challenge stats: participant counts, shown on cards before joining.
-- ─────────────────────────────────────────────
create or replace view challenge_stats
with (security_invoker = false) as
select challenge_id, count(*) as participant_count
from challenge_participants
group by challenge_id;

grant select on challenge_stats to authenticated;

-- ─────────────────────────────────────────────
-- Seed two starter challenges so there's something to join on first load.
-- Guarded by title so re-running this script doesn't duplicate them.
-- ─────────────────────────────────────────────
insert into challenges (title, description, start_date, end_date, target_workouts)
select '7-Day Kickstart', 'Log a workout at least 5 times in the next 7 days.', current_date, current_date + 6, 5
where not exists (select 1 from challenges where title = '7-Day Kickstart');

insert into challenges (title, description, start_date, end_date, target_workouts)
select '30-Day Consistency', 'Log 20 workouts over the next 30 days.', current_date, current_date + 29, 20
where not exists (select 1 from challenges where title = '30-Day Consistency');
