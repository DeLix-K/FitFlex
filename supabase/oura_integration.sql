-- Adds Oura Ring OAuth connection storage. Replaces the earlier Fitbit
-- attempt (Fitbit closed self-serve registration for new apps mid-build —
-- dropping that unused table if it was created).
--
-- Deliberately grants NOTHING to "authenticated" — the client can never
-- read raw OAuth tokens, even its own. Only the service role (used inside
-- Edge Functions) can touch this table.
-- Run this in the Supabase SQL Editor.

drop table if exists fitbit_connections;

create table if not exists oura_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now()
);

alter table oura_connections enable row level security;

-- No policies, no grants to authenticated/anon on purpose: this table is
-- only ever touched by Edge Functions using the service role key. There is
-- intentionally no way for a client to read or write it directly, even for
-- their own row.
--
-- service_role bypasses RLS but still needs an ordinary Postgres GRANT like
-- any other role (learned the hard way earlier in this project — it does
-- not get blanket table access automatically).
grant select, insert, update, delete on oura_connections to service_role;
