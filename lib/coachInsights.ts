import { getMyStats, fetchLoggedDates } from './streaks';
import { fetchSleepHistory } from './sleep';
import { fetchMoodHistory } from './wellness';
import { supabase } from './supabase';
import type { ChatMessage, CoachPersonality, DailyBriefingData, PostWorkoutInsightData } from './claude';

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fetchTodaysPlanName(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const weekday = new Date().getDay();
  const { data } = await supabase
    .from('plan_schedule')
    .select('plan_id, workout_plans(name)')
    .eq('user_id', userId)
    .eq('weekday', weekday)
    .maybeSingle();

  const row = data as unknown as { plan_id: string | null; workout_plans: { name: string } | null } | null;
  return row?.workout_plans?.name ?? null;
}

export async function fetchDailyBriefingData(): Promise<DailyBriefingData> {
  const today = toDateStr(new Date());

  const [stats, loggedToday, sleepNights, moods, planName] = await Promise.all([
    getMyStats(),
    fetchLoggedDates(today, today),
    fetchSleepHistory(1),
    fetchMoodHistory(1),
    fetchTodaysPlanName(),
  ]);

  const lastNight = sleepNights[sleepNights.length - 1];
  const latestMood = moods[moods.length - 1];

  return {
    sleepHours: lastNight?.duration_minutes != null ? lastNight.duration_minutes / 60 : null,
    sleepScore: lastNight?.sleep_score ?? null,
    mood: latestMood?.mood ?? null,
    energy: latestMood?.energy ?? null,
    stress: latestMood?.stress ?? null,
    currentStreak: stats.currentStreak,
    todaysPlanName: planName,
    hasLoggedToday: loggedToday.has(today),
  };
}

export async function fetchPostWorkoutInsightData(): Promise<PostWorkoutInsightData> {
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
  const endOfLastWeek = new Date(startOfThisWeek);
  endOfLastWeek.setDate(startOfThisWeek.getDate() - 1);

  const [stats, thisWeekDates, lastWeekDates, sleepNights] = await Promise.all([
    getMyStats(),
    fetchLoggedDates(toDateStr(startOfThisWeek), toDateStr(now)),
    fetchLoggedDates(toDateStr(startOfLastWeek), toDateStr(endOfLastWeek)),
    fetchSleepHistory(7),
  ]);

  const durationsMin = sleepNights
    .map((n) => n.duration_minutes)
    .filter((d): d is number => d != null);
  const recentSleepAvgHours =
    durationsMin.length > 0 ? durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length / 60 : null;

  return {
    currentStreak: stats.currentStreak,
    thisWeekCount: thisWeekDates.size,
    lastWeekCount: lastWeekDates.size,
    totalWorkouts: stats.totalWorkouts,
    recentSleepAvgHours,
  };
}

export async function fetchTodaysPlanForRecalibration(): Promise<{
  planName: string | null;
  exerciseNames: string[];
}> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { planName: null, exerciseNames: [] };

  const weekday = new Date().getDay();
  const { data } = await supabase
    .from('plan_schedule')
    .select('plan_id')
    .eq('user_id', userId)
    .eq('weekday', weekday)
    .maybeSingle();

  const planId = (data as { plan_id: string | null } | null)?.plan_id;
  if (!planId) return { planName: null, exerciseNames: [] };

  const { data: plan } = await supabase
    .from('workout_plans')
    .select('name, workout_plan_exercises(exercises(name))')
    .eq('id', planId)
    .single();

  if (!plan) return { planName: null, exerciseNames: [] };

  const rows = (plan.workout_plan_exercises ?? []) as unknown as {
    exercises: { name: string } | { name: string }[] | null;
  }[];
  const exerciseNames = rows.flatMap((wpe) => {
    const ex = wpe.exercises;
    if (!ex) return [];
    return Array.isArray(ex) ? ex.map((e) => e.name) : [ex.name];
  });

  return { planName: plan.name as string, exerciseNames };
}

export async function fetchCoachPersonality(): Promise<CoachPersonality> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return 'encouraging';

  const { data } = await supabase
    .from('profiles')
    .select('coach_personality')
    .eq('id', userId)
    .single();

  return (data?.coach_personality as CoachPersonality) ?? 'encouraging';
}

export async function updateCoachPersonality(personality: CoachPersonality): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('profiles')
    .update({ coach_personality: personality })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}

// Session continuity: reloads the tail of the real coach_chat transcript so
// reopening the Coach tab continues the conversation instead of resetting
// to blank. Deliberately a small window (10 exchanges), not the full
// history -- this is UI continuity, not the durable memory summary (see
// lib/coachMemory.ts), which is what actually shapes future advice.
export async function fetchRecentCoachMessages(limitExchanges = 10): Promise<ChatMessage[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('ai_history')
    .select('query, result')
    .eq('user_id', userId)
    .eq('kind', 'coach_chat')
    .order('created_at', { ascending: false })
    .limit(limitExchanges);

  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as { query: string | null; result: string }[]).reverse();
  const messages: ChatMessage[] = [];
  for (const row of rows) {
    if (row.query) messages.push({ role: 'user', content: row.query });
    messages.push({ role: 'assistant', content: row.result });
  }
  return messages;
}

// Cache-per-day: reuses today's ai_history entry for the given kind instead
// of calling Claude again, since the underlying real data (sleep, streak,
// etc.) only meaningfully changes once a day at most.
export async function fetchTodaysCachedEntry(kind: string): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('ai_history')
    .select('result')
    .eq('user_id', userId)
    .eq('kind', kind)
    .gte('created_at', startOfToday.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.result ?? null;
}
