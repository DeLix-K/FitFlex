import { askClaude, buildCoachMemoryUpdatePrompt } from './claude';
import { supabase } from './supabase';

const NO_FACTS_SENTINEL = 'No durable facts yet.';

// Regenerate at most roughly once every this many new exchanges, so the
// extra Claude call stays rare relative to normal chat traffic.
const REGEN_THRESHOLD_EXCHANGES = 20;
// ...or once at least this many days have passed with at least one new
// exchange, so an infrequent chatter's memory doesn't go stale forever.
const REGEN_MIN_DAYS = 7;
// First-ever summary waits for a handful of real exchanges rather than
// summarizing a single throwaway message.
const BOOTSTRAP_MIN_EXCHANGES = 5;

export async function fetchCoachMemory(): Promise<{ memory: string | null; updatedAt: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { memory: null, updatedAt: null };

  const { data, error } = await supabase
    .from('profiles')
    .select('coach_memory, coach_memory_updated_at')
    .eq('id', userId)
    .single();

  if (error) throw new Error(error.message);
  return { memory: data?.coach_memory ?? null, updatedAt: data?.coach_memory_updated_at ?? null };
}

export async function clearCoachMemory(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  // Reset the clock too, not just the text -- otherwise the next chat could
  // immediately see a pile of "new" exchanges since the old timestamp and
  // regenerate right back to something similar to what was just cleared.
  const { error } = await supabase
    .from('profiles')
    .update({ coach_memory: null, coach_memory_updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

// Best-effort background maintenance, not a user-facing AI action: folds
// real coach_chat exchanges (from ai_history) into the durable summary when
// enough new ones have piled up. Deliberately never writes to ai_history
// itself, so this never silently consumes a free user's daily AI quota --
// that's counted purely by counting today's ai_history rows (see
// lib/subscription.ts). Never throws; the caller treats a returned value
// equal to the previous memory as "nothing changed."
export async function regenerateCoachMemoryIfStale(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { memory: existingMemory, updatedAt } = await fetchCoachMemory();

  const since = updatedAt ?? new Date(0).toISOString();
  const { data: newRows, error } = await supabase
    .from('ai_history')
    .select('query, result')
    .eq('user_id', userId)
    .eq('kind', 'coach_chat')
    .gt('created_at', since)
    .order('created_at', { ascending: true });

  if (error || !newRows) return existingMemory;

  // Only meaningful once a memory has actually been generated before -- a
  // null updatedAt means "never generated," which is the bootstrap case
  // below, not "infinitely stale." Conflating the two used to make the
  // 7-day rule fire on the very first check with just 1 exchange, skipping
  // BOOTSTRAP_MIN_EXCHANGES entirely.
  const daysSinceUpdate = updatedAt ? (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24) : null;

  const shouldRegenerate =
    newRows.length >= REGEN_THRESHOLD_EXCHANGES ||
    (!existingMemory && newRows.length >= BOOTSTRAP_MIN_EXCHANGES) ||
    (daysSinceUpdate != null && daysSinceUpdate >= REGEN_MIN_DAYS && newRows.length >= 1);

  if (!shouldRegenerate) return existingMemory;

  const exchanges = (newRows as { query: string | null; result: string }[])
    .filter((r): r is { query: string; result: string } => !!r.query)
    .map((r) => ({ query: r.query, result: r.result }));

  if (exchanges.length === 0) return existingMemory;

  let updatedMemory: string;
  try {
    updatedMemory = (await askClaude(buildCoachMemoryUpdatePrompt(existingMemory, exchanges))).trim();
  } catch {
    // Regeneration is best-effort background upkeep -- a failed Claude call
    // shouldn't surface as an error anywhere in the chat UI.
    return existingMemory;
  }

  const memoryToStore = updatedMemory === NO_FACTS_SENTINEL ? null : updatedMemory;

  const { error: saveError } = await supabase
    .from('profiles')
    .update({ coach_memory: memoryToStore, coach_memory_updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (saveError) return existingMemory;

  return memoryToStore;
}
