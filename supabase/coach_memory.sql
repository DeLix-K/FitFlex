-- Persistent cross-session Coach memory: a compact, periodically-updated
-- summary of durable facts (injuries/limitations, preferences, goals,
-- recurring patterns) folded from real past coach_chat exchanges in
-- ai_history, fed into every future chat's system prompt so the coach
-- doesn't start from zero every session. Closes the gap flagged against
-- Oura Advisor's "Memories" feature in the earlier competitive comparison.
--
-- Same column-scoped grant pattern as coach_personality -- the client
-- updates these two columns directly (both to save a regenerated summary
-- and to let the user clear it themselves), no new Edge Function needed.
-- Regeneration is triggered lazily from the client (see lib/coachMemory.ts),
-- following the same "check if stale, only call Claude if so" pattern
-- already used for the Daily Briefing/Post-Workout Insight cache -- this
-- app has never used pg_cron and doesn't need to start here.

alter table profiles add column if not exists coach_memory text;
alter table profiles add column if not exists coach_memory_updated_at timestamptz;

grant update (coach_memory, coach_memory_updated_at) on profiles to authenticated;
