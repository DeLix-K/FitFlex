-- Allows only your account (by email) to edit exercise rows from within the app.
-- Run this in the Supabase SQL Editor.

grant update on exercises to authenticated;

create policy "Only the admin can update exercises"
  on exercises for update
  using (auth.jwt() ->> 'email' = 'teamlix6@gmail.com')
  with check (auth.jwt() ->> 'email' = 'teamlix6@gmail.com');
