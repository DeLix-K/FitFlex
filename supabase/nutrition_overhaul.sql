-- ─────────────────────────────────────────────
-- My Nutrition tab overhaul: photo-first meal logging, multimodal instant
-- capture (snap/voice/barcode/search), real adaptive targets, and honest
-- diet-quality tags (real fiber/iron from USDA/barcode data only -- never
-- fabricated for AI-estimated or manual entries).
--
-- "Menu Scanner" needed no schema change (its AI estimate is never saved
-- as a meal_log row on its own -- same "add to meals" correction step as
-- every other AI estimate in this app). "Glycemic index" tags were
-- dropped entirely -- no real data source for it exists anywhere this app
-- already integrates with (not in USDA FoodData Central, not in Open Food
-- Facts), so it was never buildable honestly, unlike fiber/iron.
-- ─────────────────────────────────────────────

alter table meal_logs drop constraint if exists meal_logs_source_check;
alter table meal_logs add constraint meal_logs_source_check
  check (source in ('manual', 'scan', 'search', 'voice', 'barcode'));

alter table meal_logs add column if not exists photo_url text;
alter table meal_logs add column if not exists fiber_g numeric check (fiber_g is null or fiber_g >= 0);
alter table meal_logs add column if not exists iron_mg numeric check (iron_mg is null or iron_mg >= 0);

-- Public bucket (simplifies serving thumbnails in the timeline feed with
-- plain URLs, no signed-URL expiry management) -- same privacy tier as a
-- profile picture, not sensitive health data. Writes are still restricted
-- to each user's own folder below.
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', true)
on conflict (id) do nothing;

drop policy if exists "Users upload their own meal photos" on storage.objects;
create policy "Users upload their own meal photos"
  on storage.objects for insert
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users view their own meal photos" on storage.objects;
create policy "Users view their own meal photos"
  on storage.objects for select
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete their own meal photos" on storage.objects;
create policy "Users delete their own meal photos"
  on storage.objects for delete
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
