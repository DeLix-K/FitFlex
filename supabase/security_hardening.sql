-- Security hardening pass (pre-launch OWASP review).
--
-- Main fix: every admin-only RLS policy in this project checked
-- `auth.jwt() ->> 'email' = 'teamlix6@gmail.com'` — a string comparison
-- against a mutable, user-supplied identity claim. Whether that's actually
-- safe depends on Supabase Auth settings (email confirmation required,
-- secure email change) staying correctly configured forever, in a project
-- with no other authorization check that relies on Auth settings at all.
-- Every other privileged flag in this app (`profiles.is_premium`,
-- `profiles.is_trainer`) is instead a boolean tied to the immutable
-- `auth.uid()` and is never client-writable. This migration makes admin
-- follow the same pattern: `profiles.is_admin`, set once via SQL, checked
-- by `auth.uid()` — not by an email string that depends on external config.

alter table profiles add column if not exists is_admin boolean not null default false;

update profiles
set is_admin = true
where id = (select id from auth.users where email = 'teamlix6@gmail.com');

-- Deliberately no grant makes is_admin client-writable (see the grants
-- block in schema.sql) — only SQL run directly against the database can
-- promote an account, same as is_premium/is_trainer.

drop policy if exists "Only the admin can update exercises" on exercises;
create policy "Only the admin can update exercises"
  on exercises for update
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

drop policy if exists "Only the admin can manage challenges" on challenges;
create policy "Only the admin can manage challenges"
  on challenges for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

drop policy if exists "Only the admin can manage trainer profiles" on trainer_profiles;
create policy "Only the admin can manage trainer profiles"
  on trainer_profiles for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

drop policy if exists "Only the admin can manage courses" on courses;
create policy "Only the admin can manage courses"
  on courses for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

drop policy if exists "Only the admin can manage course lessons" on course_lessons;
create policy "Only the admin can manage course lessons"
  on course_lessons for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

drop policy if exists "Only the admin can manage digital products" on digital_products;
create policy "Only the admin can manage digital products"
  on digital_products for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

drop policy if exists "Only the admin can manage digital product content" on digital_product_content;
create policy "Only the admin can manage digital product content"
  on digital_product_content for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));
