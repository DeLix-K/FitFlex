-- Clears two stray video_url values that don't belong to the current
-- exercise_gif_urls.sql match set:
--   - "High knees" was matched to "walking high knees lunge" in the very
--     first version of exercise_gif_urls.sql, then dropped in the follow-up
--     pass once manual review found it adds a lunge, not a plain high-knees
--     movement. The follow-up SQL only adds/updates matches, so this stale
--     value was never explicitly cleared -- doing that here.
--   - "Bodyweight Squat" has a video_url of 'https://example.com/test',
--     which was never produced by any generated SQL -- looks like a manual
--     test through the admin video editor.
update exercises set video_url = null where id = 'd224add9-4d86-40b8-8fe0-6f3652c2aead'; -- "High knees"
update exercises set video_url = null where id = 'b0d7dfb2-2d12-41a5-9b4c-8dfe986abc20'; -- "Bodyweight Squat"
