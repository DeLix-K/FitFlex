-- Adds a profiles table with a premium flag, auto-created for every new
-- signup. No payment processing yet — is_premium is toggled manually via
-- SQL for now (real billing comes in a later step).
-- Run this in the Supabase SQL Editor.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

grant select on profiles to authenticated;

-- Auto-create a profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for accounts that already existed before this migration.
insert into profiles (id)
select id from auth.users
on conflict (id) do nothing;
