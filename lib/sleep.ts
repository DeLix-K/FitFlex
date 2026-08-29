import { supabase } from './supabase';
import type { SleepBehaviorTag, SleepLog } from './types';

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

// ─────────────────────────────────────────────
// Sleep goal: drives the wind-down/bedtime guidance and the best-effort
// wake notification. Pure user-set preference, not a biometric prediction.
// ─────────────────────────────────────────────
export type SleepGoal = { sleepGoalHours: number; targetWakeTime: string };

export async function fetchSleepGoal(): Promise<SleepGoal> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { sleepGoalHours: 8, targetWakeTime: '07:00:00' };

  const { data, error } = await supabase
    .from('profiles')
    .select('sleep_goal_hours, target_wake_time')
    .eq('id', userId)
    .single();

  if (error) throw new Error(error.message);
  return {
    sleepGoalHours: data?.sleep_goal_hours ?? 8,
    targetWakeTime: data?.target_wake_time ?? '07:00:00',
  };
}

export async function updateSleepGoal(goal: SleepGoal): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('profiles')
    .update({ sleep_goal_hours: goal.sleepGoalHours, target_wake_time: goal.targetWakeTime })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}

export function parseTimeToHm(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':');
  return { hour: Number(h) || 0, minute: Number(m) || 0 };
}

function minutesToLabel(totalMinutes: number): string {
  const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${period}`;
}

// "07:30" -> "7:30 AM"
export function timeStringToLabel(time: string): string {
  const { hour, minute } = parseTimeToHm(time);
  return minutesToLabel(hour * 60 + minute);
}

// Pure arithmetic from the user's own goal (wake time - sleep duration) --
// not a personalized biometric prediction. Caffeine cutoff is the widely
// cited "stop caffeine ~8h before bed" sleep-hygiene rule of thumb, not
// derived from any tracked caffeine intake (this app doesn't log that).
export function computeWindDownTimes(
  targetWakeTime: string,
  sleepGoalHours: number
): { recommendedBedtimeLabel: string; caffeineCutoffLabel: string; recommendedBedtimeMinutes: number } {
  const [hStr, mStr] = targetWakeTime.split(':');
  const wakeMinutes = Number(hStr) * 60 + Number(mStr ?? '0');
  const bedMinutes = wakeMinutes - Math.round(sleepGoalHours * 60);
  const caffeineMinutes = bedMinutes - 8 * 60;
  return {
    recommendedBedtimeLabel: minutesToLabel(bedMinutes),
    caffeineCutoffLabel: minutesToLabel(caffeineMinutes),
    recommendedBedtimeMinutes: ((bedMinutes % 1440) + 1440) % 1440,
  };
}

// ─────────────────────────────────────────────
// Sleep debt: cumulative shortfall against the user's own real goal, over
// nights that actually have logged duration. Never invents a night.
// ─────────────────────────────────────────────
export type SleepDebt = { debtMinutes: number; nightsCounted: number };

export function computeSleepDebt(history: SleepLog[], sleepGoalHours: number, nights = 7): SleepDebt | null {
  const recent = history.slice(0, nights).filter((n) => n.duration_minutes != null);
  if (recent.length === 0) return null;

  const goalMinutes = sleepGoalHours * 60;
  const debtMinutes = recent.reduce(
    (sum, n) => sum + Math.max(0, goalMinutes - (n.duration_minutes ?? 0)),
    0
  );
  return { debtMinutes: Math.round(debtMinutes), nightsCounted: recent.length };
}

// ─────────────────────────────────────────────
// Hypnogram: Oura's real per-5-minute sleep-stage string, one character per
// 5-minute period ('1' deep, '2' light, '3' rem, '4' awake -- per Oura API
// v2 docs). Never fabricated -- only ever present for source = 'oura'.
// ─────────────────────────────────────────────
export type HypnogramStage = 'deep' | 'light' | 'rem' | 'awake' | 'unknown';
export type HypnogramSegment = { stage: HypnogramStage; startMinute: number; durationMinutes: number };

const STAGE_CHAR_MAP: Record<string, HypnogramStage> = { '1': 'deep', '2': 'light', '3': 'rem', '4': 'awake' };

export function parseHypnogram(sleepPhase5min: string | null): HypnogramSegment[] {
  if (!sleepPhase5min) return [];
  return sleepPhase5min.split('').map((ch, i) => ({
    stage: STAGE_CHAR_MAP[ch] ?? 'unknown',
    startMinute: i * 5,
    durationMinutes: 5,
  }));
}

// ─────────────────────────────────────────────
// Behavior tagging: fixed, honest self-report of daytime habits -- never
// inferred from other data.
// ─────────────────────────────────────────────
export const BEHAVIOR_TAGS: { tag: SleepBehaviorTag; label: string; emoji: string }[] = [
  { tag: 'alcohol', label: 'Alcohol', emoji: '🍷' },
  { tag: 'late_meal', label: 'Late Meal', emoji: '🍽️' },
  { tag: 'caffeine_late', label: 'Caffeine >4pm', emoji: '☕' },
  { tag: 'sauna_bath', label: 'Sauna/Bath', emoji: '🛁' },
  { tag: 'screen_time', label: 'Screen Time', emoji: '📱' },
  { tag: 'stressful_day', label: 'Stressful Day', emoji: '😣' },
  { tag: 'meditated', label: 'Meditated', emoji: '🧘' },
  { tag: 'magnesium', label: 'Magnesium', emoji: '💊' },
  { tag: 'intense_exercise', label: 'Intense Exercise', emoji: '🏋️' },
];

export async function fetchBehaviorTags(sleepDate: string): Promise<SleepBehaviorTag[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('sleep_behavior_tags')
    .select('tag')
    .eq('user_id', userId)
    .eq('sleep_date', sleepDate);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { tag: SleepBehaviorTag }) => r.tag);
}

export async function setBehaviorTag(sleepDate: string, tag: SleepBehaviorTag, enabled: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  if (enabled) {
    const { error } = await supabase
      .from('sleep_behavior_tags')
      .upsert({ user_id: userId, sleep_date: sleepDate, tag }, { onConflict: 'user_id,sleep_date,tag' });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('sleep_behavior_tags')
      .delete()
      .eq('user_id', userId)
      .eq('sleep_date', sleepDate)
      .eq('tag', tag);
    if (error) throw new Error(error.message);
  }
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
