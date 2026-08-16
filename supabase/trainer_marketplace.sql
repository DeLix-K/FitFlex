-- Adds the trainer/nutritionist marketplace: admin-curated trainer listings,
-- one-time paid "custom plan" orders via Stripe Connect (15% platform
-- commission), and a trainer-facing dashboard to fulfill orders.
-- Run this in the Supabase SQL Editor.

-- ─────────────────────────────────────────────
-- is_trainer: same manual-toggle pattern as is_premium. You flip this to
-- true (via SQL) once you've vetted someone and created their
-- trainer_profiles row — that's what "admin-curated" means for v1.
-- ─────────────────────────────────────────────
alter table profiles add column if not exists is_trainer boolean not null default false;

-- ─────────────────────────────────────────────
-- Trainer profiles: public listing. Readable by anyone (like exercises);
-- only the admin account can create/edit one, enforced by RLS.
-- ─────────────────────────────────────────────
create table if not exists trainer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  bio text not null default '',
  specialty text not null default '',
  price_cents int not null,
  stripe_account_id text,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table trainer_profiles enable row level security;

drop policy if exists "Trainer profiles are readable by anyone" on trainer_profiles;
create policy "Trainer profiles are readable by anyone"
  on trainer_profiles for select
  using (true);

drop policy if exists "Only the admin can manage trainer profiles" on trainer_profiles;
create policy "Only the admin can manage trainer profiles"
  on trainer_profiles for all
  using (auth.jwt() ->> 'email' = 'teamlix6@gmail.com')
  with check (auth.jwt() ->> 'email' = 'teamlix6@gmail.com');

-- stripe_account_id / payouts_enabled are set only by the
-- trainer-connect-onboarding Edge Function (service role), never by the
-- admin's client-side writes above or by the trainer directly.

-- ─────────────────────────────────────────────
-- Trainer orders: one row per purchase. No client-side writes at all —
-- created by create-trainer-checkout, updated by stripe-webhook (paid) and
-- trainer-deliver-plan (fulfilled), all service-role only. Clients read
-- their own orders (and trainers read theirs) through trainer_order_view
-- below, not this table directly.
-- ─────────────────────────────────────────────
create table if not exists trainer_orders (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users(id) on delete cascade,
  trainer_user_id uuid not null references auth.users(id) on delete cascade,
  trainer_profile_id uuid not null references trainer_profiles(id) on delete cascade,
  amount_cents int not null,
  platform_fee_cents int not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'fulfilled', 'refunded')),
  workout_plan_id uuid references workout_plans(id) on delete set null,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

alter table trainer_orders enable row level security;

-- ─────────────────────────────────────────────
-- Trainer order view: exposes each order plus the counterparty's display
-- name (trainer sees the client's name, client sees the trainer's), without
-- granting either side direct access to the other's profiles row. Runs
-- with owner privileges (security_invoker = false) so the join works across
-- RLS-locked tables, but the `where` clause still restricts each caller to
-- only their own orders as buyer or trainer — same secure-view pattern as
-- leaderboard and challenge_progress.
-- ─────────────────────────────────────────────
create or replace view trainer_order_view
with (security_invoker = false) as
select
  o.id,
  o.client_user_id,
  o.trainer_user_id,
  o.trainer_profile_id,
  o.amount_cents,
  o.status,
  o.workout_plan_id,
  o.created_at,
  o.fulfilled_at,
  tp.display_name as trainer_display_name,
  tp.specialty as trainer_specialty,
  coalesce(nullif(cp.display_name, ''), 'Client') as client_display_name
from trainer_orders o
join trainer_profiles tp on tp.id = o.trainer_profile_id
join profiles cp on cp.id = o.client_user_id
where auth.uid() = o.client_user_id or auth.uid() = o.trainer_user_id;

grant select on trainer_profiles to anon, authenticated;
grant insert, update, delete on trainer_profiles to authenticated;
grant select, update on trainer_profiles to service_role;
grant select on trainer_order_view to authenticated;
grant select, insert, update on trainer_orders to service_role;

-- trainer-deliver-plan creates the client's plan via service role (a
-- trainer isn't the plan's owner, so normal RLS can't allow this) — these
-- tables predate the trainer marketplace and only ever granted authenticated,
-- same class of gap as the trainer_profiles fix above.
grant select, insert, delete on workout_plans to service_role;
grant select, insert on workout_plan_exercises to service_role;
