import { getOuraData } from './oura';
import { fetchSleepHistory } from './sleep';
import { hasLoggedToday } from './streaks';
import { supabase } from './supabase';
import type {
  HabitAutoSyncSource,
  HabitTier,
  HabitTimeOfDay,
  HabitType,
  HabitWithStatus,
} from './types';

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function tierFor(progress: number | null, target: number | null): HabitTier {
  if (progress == null || target == null || target <= 0) return null;
  const pct = progress / target;
  if (pct >= 1) return 'gold';
  if (pct >= 0.75) return 'silver';
  if (pct >= 0.5) return 'bronze';
  return null;
}

export async function fetchHabits(): Promise<HabitWithStatus[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const today = todayLocalDate();

  const [habitsResult, streaksResult, todayLogsResult] = await Promise.all([
    supabase.from('habits').select('*').order('created_at', { ascending: true }),
    supabase.from('habit_streaks').select('*'),
    supabase
      .from('habit_logs')
      .select('habit_id, progress_value, source')
      .eq('user_id', userId)
      .eq('logged_date', today),
  ]);

  if (habitsResult.error) throw new Error(habitsResult.error.message);
  if (streaksResult.error) throw new Error(streaksResult.error.message);
  if (todayLogsResult.error) throw new Error(todayLogsResult.error.message);

  const streakByHabit = new Map<string, number>();
  for (const row of streaksResult.data ?? []) streakByHabit.set(row.habit_id, row.current_streak);

  const todayLogByHabit = new Map<string, { progress_value: number | null; source: string }>();
  for (const row of todayLogsResult.data ?? []) {
    todayLogByHabit.set(row.habit_id, { progress_value: row.progress_value, source: row.source });
  }

  return (habitsResult.data ?? []).map((habit) => {
    const log = todayLogByHabit.get(habit.id);
    const progressToday = log?.progress_value ?? null;
    const doneToday =
      habit.habit_type === 'numeric'
        ? progressToday != null && habit.target_value != null && progressToday >= habit.target_value
        : !!log;

    return {
      ...habit,
      current_streak: streakByHabit.get(habit.id) ?? 0,
      done_today: doneToday,
      progress_today: progressToday,
      tier_today: tierFor(progressToday, habit.target_value),
      auto_logged_today: log?.source === 'auto',
    };
  });
}

export async function createHabit(params: {
  name: string;
  habitType: HabitType;
  targetValue: number | null;
  unit: string | null;
  timeOfDay: HabitTimeOfDay;
  autoSyncSource: HabitAutoSyncSource | null;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase.from('habits').insert({
    user_id: userId,
    name: params.name.trim(),
    habit_type: params.habitType,
    target_value: params.targetValue,
    unit: params.unit,
    time_of_day: params.timeOfDay,
    auto_sync_source: params.autoSyncSource,
  });
  if (error) throw new Error(error.message);
}

export async function deleteHabit(habitId: string): Promise<void> {
  const { error } = await supabase.from('habits').delete().eq('id', habitId);
  if (error) throw new Error(error.message);
}

export async function checkInToday(habitId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('habit_logs')
    .upsert(
      { habit_id: habitId, user_id: userId, logged_date: todayLocalDate() },
      { onConflict: 'habit_id,logged_date', ignoreDuplicates: true }
    );

  if (error) throw new Error(error.message);
}

export async function uncheckToday(habitId: string): Promise<void> {
  const { error } = await supabase
    .from('habit_logs')
    .delete()
    .eq('habit_id', habitId)
    .eq('logged_date', todayLocalDate());

  if (error) throw new Error(error.message);
}

// Sets today's ABSOLUTE progress value for a numeric habit (not additive) --
// the hold-to-fill UI tracks the running total locally and calls this with
// the new total, so a dropped network call never double-counts.
export async function logProgressToday(habitId: string, progressValue: number): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase.from('habit_logs').upsert(
    {
      habit_id: habitId,
      user_id: userId,
      logged_date: todayLocalDate(),
      progress_value: Math.max(0, progressValue),
      source: 'manual',
    },
    { onConflict: 'habit_id,logged_date' }
  );

  if (error) throw new Error(error.message);
}

// ─────────────────────────────────────────────
// Auto-completion from data this app already tracks for real. Only ever
// checks habits the user explicitly set up as auto-synced, and only ever
// against real, already-fetched values -- never a fabricated sensor.
// ─────────────────────────────────────────────
export async function autoSyncHabits(habits: HabitWithStatus[]): Promise<boolean> {
  const candidates = habits.filter((h) => h.auto_sync_source && !h.done_today);
  if (candidates.length === 0) return false;

  const needsSleep = candidates.some((h) => h.auto_sync_source === 'sleep_duration');
  const needsSteps = candidates.some((h) => h.auto_sync_source === 'oura_steps');
  const needsWorkout = candidates.some((h) => h.auto_sync_source === 'workout_done');

  const [latestSleep, ouraData, workoutDone] = await Promise.all([
    needsSleep ? fetchSleepHistory(1).catch(() => []) : Promise.resolve([]),
    needsSteps ? getOuraData().catch(() => ({ connected: false as const })) : Promise.resolve({ connected: false as const }),
    needsWorkout ? hasLoggedToday().catch(() => false) : Promise.resolve(false),
  ]);

  const latestSleepMinutes = latestSleep[0]?.duration_minutes ?? null;
  const todaySteps = 'connected' in ouraData && ouraData.connected ? ouraData.steps : null;

  let anyLogged = false;
  for (const habit of candidates) {
    let eligible = false;
    if (habit.auto_sync_source === 'sleep_duration') {
      eligible = latestSleepMinutes != null && habit.target_value != null && latestSleepMinutes >= habit.target_value;
    } else if (habit.auto_sync_source === 'oura_steps') {
      eligible = todaySteps != null && habit.target_value != null && todaySteps >= habit.target_value;
    } else if (habit.auto_sync_source === 'workout_done') {
      eligible = workoutDone;
    }

    if (!eligible) continue;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) continue;

    const { error } = await supabase.from('habit_logs').upsert(
      {
        habit_id: habit.id,
        user_id: userId,
        logged_date: todayLocalDate(),
        progress_value: habit.habit_type === 'numeric' ? habit.target_value : null,
        source: 'auto',
      },
      { onConflict: 'habit_id,logged_date', ignoreDuplicates: true }
    );
    if (!error) anyLogged = true;
  }

  return anyLogged;
}

// ─────────────────────────────────────────────
// Health Momentum: consecutive days with at least one real habit logged
// (or a freeze covering the gap) -- separate from the per-workout streak.
// ─────────────────────────────────────────────
export async function fetchHabitMomentum(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return 0;

  const { data, error } = await supabase
    .from('habit_momentum')
    .select('current_streak')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.current_streak ?? 0;
}

export async function grantHabitFreezeIfEarned(): Promise<number> {
  const { data, error } = await supabase.rpc('grant_habit_freeze_if_earned');
  if (error) throw new Error(error.message);
  return data as number;
}

export async function useHabitFreeze(coveredDate: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('use_habit_freeze', { p_covered_date: coveredDate });
  if (error) throw new Error(error.message);
  return data as boolean;
}

// ─────────────────────────────────────────────
// Habit-to-performance correlation: pure client-side statistics from real
// logged data, gated on a minimum sample size in each bucket so a
// coincidence from 2 data points never gets presented as an insight.
// ─────────────────────────────────────────────
export type HabitLogHistoryRow = { habit_id: string; logged_date: string; progress_value: number | null };

export async function fetchHabitLogHistory(days = 60): Promise<HabitLogHistoryRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('habit_logs')
    .select('habit_id, logged_date, progress_value')
    .eq('user_id', userId)
    .gte('logged_date', since);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export type WorkoutLogHistoryRow = { logged_date: string; duration_minutes: number | null };

export async function fetchWorkoutLogHistory(days = 60): Promise<WorkoutLogHistoryRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('workout_logs')
    .select('logged_date, duration_minutes')
    .eq('user_id', userId)
    .gte('logged_date', since);

  if (error) throw new Error(error.message);
  return data ?? [];
}

const MIN_SAMPLE_PER_BUCKET = 4;
const MIN_RELATIVE_EFFECT = 0.1; // 10% — below this, call it noise, not an insight

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeHabitCorrelations(
  habits: { id: string; name: string; habit_type: HabitType; target_value: number | null }[],
  habitLogHistory: HabitLogHistoryRow[],
  workoutHistory: WorkoutLogHistoryRow[],
  sleepHistory: { sleep_date: string; sleep_score: number | null }[]
): string | null {
  const doneDatesByHabit = new Map<string, Set<string>>();
  for (const habit of habits) {
    const logsForHabit = habitLogHistory.filter((l) => l.habit_id === habit.id);
    const doneDates = new Set(
      logsForHabit
        .filter((l) =>
          habit.habit_type === 'numeric'
            ? l.progress_value != null && habit.target_value != null && l.progress_value >= habit.target_value
            : true
        )
        .map((l) => l.logged_date)
    );
    doneDatesByHabit.set(habit.id, doneDates);
  }

  type Candidate = { habitName: string; metric: string; pctDiff: number; text: string };
  const candidates: Candidate[] = [];

  for (const habit of habits) {
    const doneDates = doneDatesByHabit.get(habit.id) ?? new Set();
    if (doneDates.size < MIN_SAMPLE_PER_BUCKET) continue;

    // Workout-duration correlation.
    const workoutDone: number[] = [];
    const workoutNotDone: number[] = [];
    for (const w of workoutHistory) {
      if (w.duration_minutes == null) continue;
      (doneDates.has(w.logged_date) ? workoutDone : workoutNotDone).push(w.duration_minutes);
    }
    if (workoutDone.length >= MIN_SAMPLE_PER_BUCKET && workoutNotDone.length >= MIN_SAMPLE_PER_BUCKET) {
      const avgDone = average(workoutDone);
      const avgNot = average(workoutNotDone);
      if (avgNot > 0) {
        const pctDiff = (avgDone - avgNot) / avgNot;
        if (Math.abs(pctDiff) >= MIN_RELATIVE_EFFECT) {
          const direction = pctDiff > 0 ? 'longer' : 'shorter';
          candidates.push({
            habitName: habit.name,
            metric: 'workout duration',
            pctDiff: Math.abs(pctDiff),
            text: `On days you complete "${habit.name}", your workouts average ${Math.round(
              Math.abs(pctDiff) * 100
            )}% ${direction} than on days you don't.`,
          });
        }
      }
    }

    // Same-night sleep-score correlation (real Oura data only).
    const sleepDone: number[] = [];
    const sleepNotDone: number[] = [];
    for (const s of sleepHistory) {
      if (s.sleep_score == null) continue;
      (doneDates.has(s.sleep_date) ? sleepDone : sleepNotDone).push(s.sleep_score);
    }
    if (sleepDone.length >= MIN_SAMPLE_PER_BUCKET && sleepNotDone.length >= MIN_SAMPLE_PER_BUCKET) {
      const avgDone = average(sleepDone);
      const avgNot = average(sleepNotDone);
      if (avgNot > 0) {
        const pctDiff = (avgDone - avgNot) / avgNot;
        if (Math.abs(pctDiff) >= MIN_RELATIVE_EFFECT) {
          const direction = pctDiff > 0 ? 'higher' : 'lower';
          candidates.push({
            habitName: habit.name,
            metric: 'sleep score',
            pctDiff: Math.abs(pctDiff),
            text: `On days you complete "${habit.name}", your sleep score that night averages ${Math.round(
              Math.abs(pctDiff) * 100
            )}% ${direction}.`,
          });
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.pctDiff - a.pctDiff);
  return candidates[0].text;
}
