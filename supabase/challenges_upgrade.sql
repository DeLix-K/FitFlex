-- Challenges tab overhaul: quests (multi-stage), adaptive per-user targets,
-- streak shields (reusing the existing streak_freezes wallet), squads,
-- proportionate leaderboards (consistency % / improvement %), a real
-- activity feed with reactions, subscriber-exclusive/trainer-hosted
-- challenges, and symbolic (non-monetary) commitment stakes.
-- ─────────────────────────────────────────────

-- Premium-gated + trainer-hosted challenges. Both nullable/false by
-- default so every existing challenge is unaffected.
alter table challenges add column if not exists premium_only boolean not null default false;
alter table challenges add column if not exists hosted_by_trainer_id uuid references trainer_profiles(id) on delete set null;

-- ─────────────────────────────────────────────
-- Quests: an optional ordered breakdown of one challenge into narrative
-- stages (e.g. "30-Day Mobility Reset" as three 10-day stages). A
-- challenge with no rows here just behaves as a single-stage challenge,
-- exactly as before.
-- ─────────────────────────────────────────────
create table if not exists challenge_stages (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  order_index int not null,
  title text not null,
  description text not null default '',
  duration_days int not null check (duration_days between 1 and 90),
  target_workouts int not null check (target_workouts between 1 and 90),
  unique (challenge_id, order_index)
);

alter table challenge_stages enable row level security;

drop policy if exists "Stages are readable by anyone" on challenge_stages;
create policy "Stages are readable by anyone"
  on challenge_stages for select
  using (true);

-- Same self-service-by-creator pattern as challenges itself.
drop policy if exists "Creator manages their own challenge stages" on challenge_stages;
create policy "Creator manages their own challenge stages"
  on challenge_stages for all
  using (exists (select 1 from challenges c where c.id = challenge_id and c.creator_user_id = auth.uid()))
  with check (exists (select 1 from challenges c where c.id = challenge_id and c.creator_user_id = auth.uid()));

drop policy if exists "Admin manages any challenge stages" on challenge_stages;
create policy "Admin manages any challenge stages"
  on challenge_stages for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

grant select, insert, update, delete on challenge_stages to authenticated;

-- Per-user, per-stage progress: workouts logged inside that stage's date
-- sub-window (stages are consecutive within the parent challenge's date
-- range, starting at challenge.start_date).
create or replace view challenge_stage_progress
with (security_invoker = false) as
with stage_windows as (
  select
    cs.id as stage_id,
    cs.challenge_id,
    cs.order_index,
    cs.title,
    cs.target_workouts,
    c.start_date + coalesce(sum(cs.duration_days) over (
      partition by cs.challenge_id order by cs.order_index
      rows between unbounded preceding and 1 preceding
    ), 0)::int as stage_start,
    c.start_date + coalesce(sum(cs.duration_days) over (
      partition by cs.challenge_id order by cs.order_index
      rows between unbounded preceding and 1 preceding
    ), 0)::int + cs.duration_days - 1 as stage_end
  from challenge_stages cs
  join challenges c on c.id = cs.challenge_id
)
select
  sw.stage_id,
  sw.challenge_id,
  sw.order_index,
  sw.title,
  sw.target_workouts,
  sw.stage_start,
  sw.stage_end,
  cp.user_id,
  (
    select count(*) from workout_logs wl
    where wl.user_id = cp.user_id and wl.logged_date between sw.stage_start and sw.stage_end
  ) as workouts_logged
from stage_windows sw
join challenge_participants cp on cp.challenge_id = sw.challenge_id;

grant select on challenge_stage_progress to authenticated;

-- ─────────────────────────────────────────────
-- Adaptive per-user target + streak shields spent on a challenge. Shields
-- reuse the SAME global streak_freezes wallet built for the Streaks tab --
-- no separate currency.
-- ─────────────────────────────────────────────
alter table challenge_participants add column if not exists personal_target int;
alter table challenge_participants add column if not exists shields_used int not null default 0;
alter table challenge_participants add column if not exists commitment text not null default '';

-- Bug fix: the original challenges.sql grant never included UPDATE, so the
-- existing RLS policy ("for all", own row only) had no effect for updates --
-- Postgres checks the table-level GRANT before RLS. Client-side commitment
-- edits (lib/challenges.ts updateCommitment()) need this; shield/target
-- writes go through SECURITY DEFINER functions so they were unaffected.
grant update on challenge_participants to authenticated;

-- Recomputes a fair personal target from the user's REAL recent workout
-- frequency (their own average over the 4 weeks before joining), scaled to
-- the challenge length and clamped to a sane range of the base target, so
-- a beginner and a veteran can both realistically hit 100%. Called once at
-- join time; existing participants are unaffected by later changes.
create or replace function compute_adaptive_target(p_user_id uuid, p_challenge_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_target int;
  v_duration_days int;
  v_recent_avg_per_week numeric;
  v_scaled int;
begin
  select target_workouts, (end_date - start_date + 1)
    into v_base_target, v_duration_days
    from challenges where id = p_challenge_id;

  if v_base_target is null then
    return null;
  end if;

  select count(*)::numeric / 4.0 into v_recent_avg_per_week
    from workout_logs
    where user_id = p_user_id
      and logged_date >= current_date - 28
      and logged_date < current_date;

  -- No recent history to scale from -- use the challenge's own base target.
  if v_recent_avg_per_week is null or v_recent_avg_per_week <= 0 then
    return v_base_target;
  end if;

  v_scaled := round(v_recent_avg_per_week * (v_duration_days::numeric / 7.0));

  -- Clamp to 50%-150% of the base target so the challenge stays
  -- recognizably "the same challenge" for everyone, just fairly scaled.
  return greatest(round(v_base_target * 0.5), least(round(v_base_target * 1.5), v_scaled));
end;
$$;

grant execute on function compute_adaptive_target(uuid, uuid) to authenticated;

-- Spends one freeze from the user's existing streak_freezes wallet to
-- excuse a missed day within this challenge (Premium only, per the
-- "Streak Armor" subscriber perk) -- capped so shields can't cover more
-- than 30% of the (personal or base) target.
create or replace function use_challenge_shield(p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_premium boolean;
  v_balance int;
  v_shields_used int;
  v_target int;
  v_cap int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select is_premium into v_is_premium from profiles where id = v_user_id;
  if not coalesce(v_is_premium, false) then
    return false;
  end if;

  select balance into v_balance from streak_freezes where user_id = v_user_id for update;
  if v_balance is null or v_balance < 1 then
    return false;
  end if;

  select shields_used, coalesce(personal_target, c.target_workouts)
    into v_shields_used, v_target
    from challenge_participants cpt
    join challenges c on c.id = cpt.challenge_id
    where cpt.challenge_id = p_challenge_id and cpt.user_id = v_user_id
    for update of cpt;

  if v_target is null then
    return false; -- not a participant
  end if;

  v_cap := greatest(1, round(v_target * 0.3));
  if v_shields_used >= v_cap then
    return false;
  end if;

  update streak_freezes set balance = balance - 1, updated_at = now() where user_id = v_user_id;
  update challenge_participants set shields_used = shields_used + 1
    where challenge_id = p_challenge_id and user_id = v_user_id;

  return true;
end;
$$;

grant execute on function use_challenge_shield(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- Squads: 3-5 person teams within one challenge, combining real progress.
-- ─────────────────────────────────────────────
create table if not exists challenge_teams (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (challenge_id, name)
);

alter table challenge_teams enable row level security;

drop policy if exists "Teams are readable by anyone" on challenge_teams;
create policy "Teams are readable by anyone"
  on challenge_teams for select
  using (true);

drop policy if exists "Participants can create a team" on challenge_teams;
create policy "Participants can create a team"
  on challenge_teams for insert
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from challenge_participants cp
      where cp.challenge_id = challenge_teams.challenge_id and cp.user_id = auth.uid()
    )
  );

grant select, insert on challenge_teams to authenticated;

create table if not exists challenge_team_members (
  team_id uuid not null references challenge_teams(id) on delete cascade,
  challenge_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id),
  unique (challenge_id, user_id)
);

-- Keeps challenge_id in sync with the parent team so the unique
-- (challenge_id, user_id) constraint above (one team per challenge per
-- user) can never drift out of sync with which team a row actually
-- belongs to.
create or replace function set_team_member_challenge_id()
returns trigger
language plpgsql
as $$
begin
  select challenge_id into new.challenge_id from challenge_teams where id = new.team_id;
  return new;
end;
$$;

drop trigger if exists trg_set_team_member_challenge_id on challenge_team_members;
create trigger trg_set_team_member_challenge_id
  before insert on challenge_team_members
  for each row execute function set_team_member_challenge_id();

-- Caps a team at 5 members.
create or replace function enforce_team_size_limit()
returns trigger
language plpgsql
as $$
declare
  v_count int;
begin
  select count(*) into v_count from challenge_team_members where team_id = new.team_id;
  if v_count >= 5 then
    raise exception 'This squad is already full (5/5).';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_team_size_limit on challenge_team_members;
create trigger trg_enforce_team_size_limit
  before insert on challenge_team_members
  for each row execute function enforce_team_size_limit();

alter table challenge_team_members enable row level security;

drop policy if exists "Team membership is readable by anyone" on challenge_team_members;
create policy "Team membership is readable by anyone"
  on challenge_team_members for select
  using (true);

drop policy if exists "Users manage their own team membership" on challenge_team_members;
drop policy if exists "Users can join a team in a challenge they're part of" on challenge_team_members;
create policy "Users can join a team in a challenge they're part of"
  on challenge_team_members for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from challenge_participants cp
      join challenge_teams t on t.id = challenge_team_members.team_id
      where cp.challenge_id = t.challenge_id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can leave their own team" on challenge_team_members;
create policy "Users can leave their own team"
  on challenge_team_members for delete
  using (auth.uid() = user_id);

grant select, insert, delete on challenge_team_members to authenticated;

-- Real combined team progress: sum of each member's actual workouts_logged
-- (from the existing challenge_progress view) plus their spent shields.
create or replace view challenge_team_progress
with (security_invoker = false) as
select
  t.id as team_id,
  t.challenge_id,
  t.name,
  count(tm.user_id) as member_count,
  coalesce(sum(cp.workouts_logged), 0) as total_workouts_logged,
  coalesce(sum(part.shields_used), 0) as total_shields_used,
  coalesce(sum(coalesce(part.personal_target, c.target_workouts)), 0) as total_target
from challenge_teams t
join challenges c on c.id = t.challenge_id
left join challenge_team_members tm on tm.team_id = t.id
left join challenge_progress cp on cp.challenge_id = t.challenge_id and cp.user_id = tm.user_id
left join challenge_participants part on part.challenge_id = t.challenge_id and part.user_id = tm.user_id
group by t.id, t.challenge_id, t.name, c.target_workouts;

grant select on challenge_team_progress to authenticated;

-- ─────────────────────────────────────────────
-- Proportionate leaderboards: adds a real pre-challenge baseline (average
-- workouts/week in the 4 weeks before the challenge started) so the client
-- can compute Consistency % and Personal Improvement % without inventing
-- anything -- both are derived entirely from real logged dates.
-- (Appended as new columns per Postgres's view-replace column-order rule.)
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
  ) as workouts_logged,
  coalesce(cp.personal_target, c.target_workouts) as effective_target,
  cp.shields_used,
  cp.commitment,
  (
    select count(*)::numeric / 4.0 from workout_logs wl2
    where wl2.user_id = cp.user_id
      and wl2.logged_date >= c.start_date - 28
      and wl2.logged_date < c.start_date
  ) as baseline_workouts_per_week
from challenge_participants cp
join challenges c on c.id = cp.challenge_id
join profiles p on p.id = cp.user_id;

-- ─────────────────────────────────────────────
-- Activity feed + reactions: a real event log (never synthetic), readable
-- live via Supabase Realtime by any participant of that challenge.
-- ─────────────────────────────────────────────
create table if not exists challenge_activity (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('joined', 'logged_day', 'completed')),
  created_at timestamptz not null default now()
);

create index if not exists challenge_activity_challenge_idx on challenge_activity (challenge_id, created_at desc);

alter table challenge_activity enable row level security;

drop policy if exists "Participants can read challenge activity" on challenge_activity;
create policy "Participants can read challenge activity"
  on challenge_activity for select
  using (
    exists (
      select 1 from challenge_participants cp
      where cp.challenge_id = challenge_activity.challenge_id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "Participants can post their own activity" on challenge_activity;
create policy "Participants can post their own activity"
  on challenge_activity for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from challenge_participants cp
      where cp.challenge_id = challenge_activity.challenge_id and cp.user_id = auth.uid()
    )
  );

grant select, insert on challenge_activity to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'challenge_activity'
  ) then
    alter publication supabase_realtime add table challenge_activity;
  end if;
end $$;

create table if not exists challenge_reactions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references challenge_activity(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('high_five', 'boost')),
  created_at timestamptz not null default now(),
  unique (activity_id, from_user_id, reaction_type)
);

alter table challenge_reactions enable row level security;

drop policy if exists "Participants can read reactions" on challenge_reactions;
create policy "Participants can read reactions"
  on challenge_reactions for select
  using (
    exists (
      select 1 from challenge_activity ca
      join challenge_participants cp on cp.challenge_id = ca.challenge_id
      where ca.id = challenge_reactions.activity_id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "Participants can react" on challenge_reactions;
create policy "Participants can react"
  on challenge_reactions for insert
  with check (
    auth.uid() = from_user_id
    and exists (
      select 1 from challenge_activity ca
      join challenge_participants cp on cp.challenge_id = ca.challenge_id
      where ca.id = challenge_reactions.activity_id and cp.user_id = auth.uid()
    )
  );

grant select, insert on challenge_reactions to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'challenge_reactions'
  ) then
    alter publication supabase_realtime add table challenge_reactions;
  end if;
end $$;
