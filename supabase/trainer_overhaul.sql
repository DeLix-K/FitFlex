-- ─────────────────────────────────────────────
-- My Trainers tab overhaul: video intro reels, real in-app availability
-- booking (no external calendar OAuth -- see below), real ratings gated to
-- actually-fulfilled orders, and an honest async form-review workflow.
--
-- Deliberately NOT built this pass (see the trainer-overhaul discussion):
-- live in-app video calls, pose-estimation/joint-angle overlays, live
-- wearable biometric HUDs, Google/Apple Calendar sync, and Stripe
-- Identity/Persona ID verification -- all need real third-party
-- infrastructure (a video SDK vendor, on-device ML, OAuth calendar
-- integration, a paid KYC service) beyond one build pass. Live sessions
-- instead get a scheduled time + the trainer's own external video-call
-- link (Zoom/Meet/etc), opened from the app -- honest about what it is.
-- The "Verified Coach" badge is real too: it reflects actual Stripe
-- Connect payouts_enabled status, never a fabricated ID-verification claim.
-- ─────────────────────────────────────────────

alter table trainer_profiles add column if not exists intro_video_url text;
alter table trainer_profiles add column if not exists training_format text[] not null default '{}';
alter table trainer_profiles add column if not exists location_text text default '';
alter table trainer_profiles add column if not exists default_video_call_link text;
alter table trainer_profiles add column if not exists coaching_style text
  check (coaching_style is null or coaching_style in ('high_energy', 'technical', 'empathetic'));

-- ─────────────────────────────────────────────
-- Real in-app availability: the trainer creates specific bookable slots
-- (not a recurring weekly pattern -- explicit instances are simpler to
-- reason about and avoid timezone/exception-handling complexity). Booking
-- goes through book_trainer_slot() (SECURITY DEFINER) so two clients can
-- never win the same slot in a race, and so a client can never write
-- booked_by_user_id directly.
-- ─────────────────────────────────────────────
create table if not exists trainer_time_slots (
  id uuid primary key default gen_random_uuid(),
  trainer_user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes int not null default 30 check (duration_minutes > 0),
  slot_type text not null default 'session' check (slot_type in ('intro', 'session')),
  status text not null default 'open' check (status in ('open', 'booked', 'cancelled')),
  booked_by_user_id uuid references auth.users(id) on delete set null,
  video_call_link text,
  created_at timestamptz not null default now()
);

alter table trainer_time_slots enable row level security;

drop policy if exists "Trainers manage their own time slots" on trainer_time_slots;
create policy "Trainers manage their own time slots"
  on trainer_time_slots for all
  using (trainer_user_id = auth.uid())
  with check (trainer_user_id = auth.uid());

drop policy if exists "Clients see slots they booked" on trainer_time_slots;
create policy "Clients see slots they booked"
  on trainer_time_slots for select
  using (booked_by_user_id = auth.uid());

grant select, insert, update, delete on trainer_time_slots to authenticated;

create index if not exists trainer_time_slots_trainer_idx on trainer_time_slots (trainer_user_id, starts_at);

-- Public-safe browsing: open slots only, no identity of who's booked what
-- else on the trainer's calendar.
create or replace view trainer_open_slots_view
with (security_invoker = false) as
select id, trainer_user_id, starts_at, duration_minutes, slot_type
from trainer_time_slots
where status = 'open' and starts_at > now();

grant select on trainer_open_slots_view to authenticated;

create or replace function book_trainer_slot(p_slot_id uuid)
returns trainer_time_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot trainer_time_slots;
begin
  update trainer_time_slots
  set status = 'booked', booked_by_user_id = auth.uid()
  where id = p_slot_id and status = 'open' and trainer_user_id <> auth.uid() and starts_at > now()
  returning * into v_slot;

  if v_slot.id is null then
    raise exception 'That slot is no longer available.';
  end if;

  return v_slot;
end;
$$;

grant execute on function book_trainer_slot(uuid) to authenticated;

create or replace function cancel_trainer_booking(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update trainer_time_slots
  set status = 'open', booked_by_user_id = null
  where id = p_slot_id and booked_by_user_id = auth.uid();

  if not found then
    raise exception 'Booking not found.';
  end if;
end;
$$;

grant execute on function cancel_trainer_booking(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- Real reviews: only for orders that actually reached 'fulfilled', one per
-- order, enforced server-side (SECURITY DEFINER) so a review can never be
-- faked for a purchase that didn't happen or wasn't delivered.
-- ─────────────────────────────────────────────
create table if not exists trainer_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references trainer_orders(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  trainer_user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

alter table trainer_reviews enable row level security;

drop policy if exists "Reviews are readable by anyone" on trainer_reviews;
create policy "Reviews are readable by anyone"
  on trainer_reviews for select
  using (true);

grant select on trainer_reviews to anon, authenticated;

create or replace function submit_trainer_review(p_order_id uuid, p_rating int, p_comment text)
returns trainer_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order trainer_orders;
  v_review trainer_reviews;
begin
  select * into v_order from trainer_orders
  where id = p_order_id and client_user_id = auth.uid() and status = 'fulfilled';

  if v_order.id is null then
    raise exception 'This order is not eligible for a review yet.';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5.';
  end if;

  insert into trainer_reviews (order_id, client_user_id, trainer_user_id, rating, comment)
  values (p_order_id, auth.uid(), v_order.trainer_user_id, p_rating, coalesce(p_comment, ''))
  on conflict (order_id) do update set rating = excluded.rating, comment = excluded.comment
  returning * into v_review;

  return v_review;
end;
$$;

grant execute on function submit_trainer_review(uuid, int, text) to authenticated;

-- Aggregate rating per trainer, readable by anyone (powers the star rating
-- shown on public trainer listings).
create or replace view trainer_rating_view
with (security_invoker = false) as
select trainer_user_id, round(avg(rating)::numeric, 1) as avg_rating, count(*) as review_count
from trainer_reviews
group by trainer_user_id;

grant select on trainer_rating_view to anon, authenticated;

-- ─────────────────────────────────────────────
-- Async Form Review, the honest version: a real client-uploaded video, a
-- real trainer voice-note + text response. No 3D reference model, no
-- automated joint-angle detection -- neither exists anywhere this app
-- integrates with. Open between any trainer/client pair that already has
-- a messaging relationship (same openness as trainer_messaging), not
-- gated to a paid order.
-- ─────────────────────────────────────────────
create table if not exists trainer_form_reviews (
  id uuid primary key default gen_random_uuid(),
  trainer_user_id uuid not null references auth.users(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null default '',
  video_url text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  voice_note_url text,
  comment text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table trainer_form_reviews enable row level security;

drop policy if exists "Clients manage their own form review requests" on trainer_form_reviews;
create policy "Clients manage their own form review requests"
  on trainer_form_reviews for all
  using (client_user_id = auth.uid())
  with check (client_user_id = auth.uid());

drop policy if exists "Trainers see and respond to their form review requests" on trainer_form_reviews;
create policy "Trainers see and respond to their form review requests"
  on trainer_form_reviews for select
  using (trainer_user_id = auth.uid());

drop policy if exists "Trainers respond to their form review requests" on trainer_form_reviews;
create policy "Trainers respond to their form review requests"
  on trainer_form_reviews for update
  using (trainer_user_id = auth.uid())
  with check (trainer_user_id = auth.uid());

grant select, insert, update on trainer_form_reviews to authenticated;

-- ─────────────────────────────────────────────
-- Storage: trainer intro reels, client form-check videos, and trainer
-- voice-note responses. Public bucket (same reasoning as meal-photos --
-- these are meant to be seen, not sensitive), writes scoped to each
-- uploader's own folder.
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('trainer-media', 'trainer-media', true)
on conflict (id) do nothing;

drop policy if exists "Users upload their own trainer media" on storage.objects;
create policy "Users upload their own trainer media"
  on storage.objects for insert
  with check (bucket_id = 'trainer-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users view their own trainer media" on storage.objects;
create policy "Users view their own trainer media"
  on storage.objects for select
  using (bucket_id = 'trainer-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete their own trainer media" on storage.objects;
create policy "Users delete their own trainer media"
  on storage.objects for delete
  using (bucket_id = 'trainer-media' and (storage.foldername(name))[1] = auth.uid()::text);
