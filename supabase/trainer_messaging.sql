-- Real-time-ish 1:1 messaging between a client and a trainer, backed by a
-- genuine table (not simulated) so "Message the trainer" actually works.
-- One thread per (trainer, client) pair, identified by the two user ids --
-- no separate "conversation" row needed since that pair is already unique.
-- ─────────────────────────────────────────────
create table if not exists trainer_messages (
  id uuid primary key default gen_random_uuid(),
  trainer_user_id uuid not null references auth.users(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists trainer_messages_thread_idx
  on trainer_messages (trainer_user_id, client_user_id, created_at);

alter table trainer_messages enable row level security;

drop policy if exists "Participants can read their own thread" on trainer_messages;
create policy "Participants can read their own thread"
  on trainer_messages for select
  using (auth.uid() = trainer_user_id or auth.uid() = client_user_id);

drop policy if exists "Participants can send messages in their own thread" on trainer_messages;
create policy "Participants can send messages in their own thread"
  on trainer_messages for insert
  with check (
    sender_id = auth.uid()
    and (auth.uid() = trainer_user_id or auth.uid() = client_user_id)
  );

grant select, insert on trainer_messages to authenticated;
grant select, insert on trainer_messages to service_role;
