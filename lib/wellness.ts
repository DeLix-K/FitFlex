import { saveHistoryEntry } from './aiHistory';
import { askClaude, buildWellnessReflectionPrompt } from './claude';
import { supabase } from './supabase';
import type { HydrationLog, MoodLog } from './types';

export function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchMoodHistory(days = 14): Promise<MoodLog[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('mood_logs')
    .select('*')
    .gte('log_date', since)
    .order('log_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function logMood(params: {
  logDate: string;
  mood: number;
  notes: string;
  stress: number | null;
  energy: number | null;
}): Promise<MoodLog> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('mood_logs')
    .upsert(
      {
        user_id: userId,
        log_date: params.logDate,
        mood: params.mood,
        notes: params.notes,
        stress: params.stress,
        energy: params.energy,
      },
      { onConflict: 'user_id,log_date' }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchHydrationToday(logDate: string): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return 0;

  const { data, error } = await supabase
    .from('hydration_logs')
    .select('glasses')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as HydrationLog | null)?.glasses ?? 0;
}

export async function setHydrationToday(logDate: string, glasses: number): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('hydration_logs')
    .upsert(
      { user_id: userId, log_date: logDate, glasses: Math.max(0, glasses) },
      { onConflict: 'user_id,log_date' }
    );

  if (error) throw new Error(error.message);
}

export async function reflectOnMood(moodLogId: string, mood: number, notes: string): Promise<string> {
  const reply = await askClaude(buildWellnessReflectionPrompt(mood, notes));

  const { error } = await supabase
    .from('mood_logs')
    .update({ ai_reflection: reply })
    .eq('id', moodLogId);

  if (error) throw new Error(error.message);

  saveHistoryEntry('mood_reflection', reply, notes || undefined);
  return reply;
}
