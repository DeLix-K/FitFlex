import { supabase } from './supabase';
import type { AiHistoryEntry, AiHistoryKind } from './types';

export async function saveHistoryEntry(
  kind: AiHistoryKind,
  result: string,
  query?: string
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  // Best-effort: history is a convenience feature, so a failed save shouldn't
  // interrupt the user from seeing the AI result they already got.
  await supabase
    .from('ai_history')
    .insert({ user_id: userId, kind, query: query ?? null, result });
}

export async function fetchHistory(): Promise<AiHistoryEntry[]> {
  const { data, error } = await supabase
    .from('ai_history')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
