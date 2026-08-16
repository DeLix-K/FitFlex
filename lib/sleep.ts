import { supabase } from './supabase';
import type { SleepLog } from './types';

export function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function yesterdayLocalDate(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchSleepHistory(days = 14): Promise<SleepLog[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('sleep_logs')
    .select('*')
    .gte('sleep_date', since)
    .order('sleep_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function logSleepManually(params: {
  sleepDate: string;
  hours: number;
  qualityRating: number | null;
  notes: string;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase.from('sleep_logs').upsert(
    {
      user_id: userId,
      sleep_date: params.sleepDate,
      duration_minutes: Math.round(params.hours * 60),
      quality_rating: params.qualityRating,
      notes: params.notes,
      source: 'manual',
    },
    { onConflict: 'user_id,sleep_date' }
  );

  if (error) throw new Error(error.message);
}

export async function syncOuraSleep(): Promise<{ connected: boolean; synced: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke<{
    connected: boolean;
    synced: number;
    error?: string;
  }>('oura-sleep-sync', { body: {} });

  if (error) {
    const context = (error as { context?: Response }).context;
    let detailedMessage: string | undefined;
    if (context) {
      try {
        const errorBody = await context.clone().json();
        if (errorBody?.error) detailedMessage = errorBody.error;
      } catch {
        // fall through
      }
    }
    throw new Error(detailedMessage ?? error.message);
  }

  if (!data) throw new Error('No response from Oura sync.');
  return data;
}
