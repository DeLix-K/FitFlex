-- ─────────────────────────────────────────────
-- Session Packages: closes the real monetization gap flagged in the
-- trainer-marketplace competitive comparison (Fyt sells session bundles;
-- this app previously only sold one fixed-price "custom plan"). Reuses the
-- exact Stripe Connect destination-charge + 15% platform fee pattern
-- already proven in create-trainer-checkout/stripe-webhook -- same vendor,
-- same fee rate, same pending->paid lifecycle, just a second product type.
--
-- Unlike trainer_profiles, these tables use normal per-user ownership RLS
-- (no admin-only lockdown, no Edge Function needed for trainer writes) --
-- same reasoning as trainer_time_slots: a trainer managing their own
-- pricing offerings never touches the sensitive is_trainer flag.
-- ─────────────────────────────────────────────

create table if not exists trainer_session_packages (
  id uuid primary key default gen_random_uuid(),
  trainer_user_id uuid not null references auth.users(id) on delete cascade,
  trainer_profile_id uuid not null references trainer_profiles(id) on delete cascade,
  name text not null,
  session_count int not null check (session_count between 1 and 50),
  price_cents int not null check (price_cents >= 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table trainer_session_packages enable row level security;

drop policy if exists "Packages are readable by anyone" on trainer_session_packages;
create policy "Packages are readable by anyone"
  on trainer_session_packages for select
  using (true);

drop policy if exists "Trainers manage their own packages" on trainer_session_packages;
create policy "Trainers manage their own packages"
  on trainer_session_packages for all
  using (trainer_user_id = auth.uid())
  with check (trainer_user_id = auth.uid());

grant select on trainer_session_packages to anon, authenticated;
grant insert, update, delete on trainer_session_packages to authenticated;

-- A client's purchased, redeemable session credits with a specific trainer.
-- No client-side writes at all -- created 'pending' by create-package-checkout,
-- flipped to 'paid' by stripe-webhook, decremented only by
-- book_trainer_slot() below. Same "no client-side writes" discipline as
-- trainer_orders.
create table if not exists trainer_session_credits (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users(id) on delete cascade,
  trainer_user_id uuid not null references auth.users(id) on delete cascade,
  package_id uuid not null references trainer_session_packages(id) on delete cascade,
  sessions_purchased int not null,
  sessions_used int not null default 0,
  stripe_checkout_session_id text,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

alter table trainer_session_credits enable row level security;

drop policy if exists "Clients see their own session credits" on trainer_session_credits;
create policy "Clients see their own session credits"
  on trainer_session_credits for select
  using (client_user_id = auth.uid());

drop policy if exists "Trainers see credits clients hold with them" on trainer_session_credits;
create policy "Trainers see credits clients hold with them"
  on trainer_session_credits for select
  using (trainer_user_id = auth.uid());

grant select on trainer_session_credits to authenticated;
grant select, insert, update on trainer_session_credits to service_role;

create or replace view trainer_session_credit_balance
with (security_invoker = true) as
select trainer_user_id, client_user_id, sum(sessions_purchased - sessions_used) as sessions_remaining
from trainer_session_credits
where status = 'paid'
group by trainer_user_id, client_user_id
having sum(sessions_purchased - sessions_used) > 0;

grant select on trainer_session_credit_balance to authenticated;

-- Tracks exactly which credit a booking consumed, so cancelling a session
-- restores that specific credit rather than guessing which batch to refund.
alter table trainer_time_slots add column if not exists consumed_credit_id uuid references trainer_session_credits(id) on delete set null;

-- ─────────────────────────────────────────────
-- Extends book_trainer_slot() (from trainer_overhaul.sql): booking a
-- 'session' slot now requires a real, paid session credit IF the trainer
-- has defined any active package -- backward compatible, a trainer who
-- never sets up packages keeps today's free-to-book session behavior.
-- 'intro' slots are never gated -- that's the free test-drive by design.
-- ─────────────────────────────────────────────
create or replace function book_trainer_slot(p_slot_id uuid)
returns trainer_time_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot trainer_time_slots;
  v_credit_id uuid;
begin
  update trainer_time_slots
  set status = 'booked', booked_by_user_id = auth.uid()
  where id = p_slot_id and status = 'open' and trainer_user_id <> auth.uid() and starts_at > now()
  returning * into v_slot;

  if v_slot.id is null then
    raise exception 'That slot is no longer available.';
  end if;

  if v_slot.slot_type = 'session' and exists (
    select 1 from trainer_session_packages where trainer_user_id = v_slot.trainer_user_id and active
  ) then
    select id into v_credit_id from trainer_session_credits
    where client_user_id = auth.uid() and trainer_user_id = v_slot.trainer_user_id
      and status = 'paid' and sessions_used < sessions_purchased
    order by created_at asc
    limit 1
    for update;

    if v_credit_id is null then
      raise exception 'You need a session package with this trainer to book a session -- buy one from their profile first.';
    end if;

    update trainer_session_credits set sessions_used = sessions_used + 1 where id = v_credit_id;
    update trainer_time_slots set consumed_credit_id = v_credit_id where id = v_slot.id;
    v_slot.consumed_credit_id := v_credit_id;
  end if;

  return v_slot;
end;
$$;

grant execute on function book_trainer_slot(uuid) to authenticated;

-- Cancelling a booking restores the specific credit it consumed (if any),
-- so a client is never charged a real session for a booking that never
-- happened.
create or replace function cancel_trainer_booking(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit_id uuid;
begin
  select consumed_credit_id into v_credit_id
  from trainer_time_slots
  where id = p_slot_id and booked_by_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;

  update trainer_time_slots
  set status = 'open', booked_by_user_id = null, consumed_credit_id = null
  where id = p_slot_id;

  if v_credit_id is not null then
    update trainer_session_credits set sessions_used = greatest(0, sessions_used - 1) where id = v_credit_id;
  end if;
end;
$$;

grant execute on function cancel_trainer_booking(uuid) to authenticated;
