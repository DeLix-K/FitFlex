import { saveHistoryEntry } from './aiHistory';
import { askClaude, buildWellnessRecommendationPrompt, buildWellnessReflectionPrompt } from './claude';
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

// ─────────────────────────────────────────────
// Rotating daily reflection prompt -- deterministic by day-of-year so it's
// stable within a day but varies day to day, no server round-trip needed.
// ─────────────────────────────────────────────
export const REFLECTION_PROMPTS = [
  'What is one physical win you had today?',
  "What's one thing your body is telling you right now?",
  'What are you grateful for today, big or small?',
  'What drained your energy today, and what gave it back?',
  'What would make tomorrow 1% easier on yourself?',
  'What is one thing you did today that your future self will thank you for?',
  'How did you handle stress today — and how do you wish you had?',
];

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getTodayPrompt(): string {
  return REFLECTION_PROMPTS[dayOfYear(new Date()) % REFLECTION_PROMPTS.length];
}

// ─────────────────────────────────────────────
// Free, rule-based recommendation -- not AI, just a deterministic mapping
// from the real aggregate score to guidance. The AI-personalized version
// (buildWellnessRecommendationPrompt) is the Premium upsell on top of this.
// ─────────────────────────────────────────────
export function contextualRecommendation(score: number | null): string {
  if (score == null) return 'Check in below to get a recommendation based on your real signals.';
  if (score >= 75) return 'Readiness is high — a good day to prime your nervous system for dynamic lifting.';
  if (score >= 50) return 'Readiness is moderate — normal training should feel fine, but listen to your body.';
  if (score >= 30) return 'High strain detected — consider 10 minutes of active recovery and breathwork today.';
  return 'Readiness is low — prioritize rest, hydration, and gentle movement today.';
}

export async function generateWellnessRecommendation(params: {
  wellnessScore: number | null;
  mood: number | null;
  stress: number | null;
  energy: number | null;
  recoveryScore: number | null;
  sleepHours: number | null;
}): Promise<string> {
  const reply = await askClaude(buildWellnessRecommendationPrompt(params));
  saveHistoryEntry('wellness_recommendation', reply);
  return reply;
}

// ─────────────────────────────────────────────
// Training-day vs rest-day sleep correlation -- pure client-side stats from
// real logged data, gated on a minimum sample size in each bucket. Same
// same-date convention as the Habits correlation engine (a sleep_logs row's
// date is treated as the night associated with that calendar day).
// ─────────────────────────────────────────────
export type SleepPerformanceInsight = {
  trainDayAvgScore: number;
  restDayAvgScore: number;
  pctDiff: number;
  nightsTrain: number;
  nightsRest: number;
} | null;

export function computeSleepPerformanceCorrelation(
  workoutDates: Set<string>,
  sleepHistory: { sleep_date: string; sleep_score: number | null }[]
): SleepPerformanceInsight {
  const MIN_SAMPLE = 4;
  const trainScores: number[] = [];
  const restScores: number[] = [];
  for (const s of sleepHistory) {
    if (s.sleep_score == null) continue;
    (workoutDates.has(s.sleep_date) ? trainScores : restScores).push(s.sleep_score);
  }
  if (trainScores.length < MIN_SAMPLE || restScores.length < MIN_SAMPLE) return null;

  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const trainDayAvgScore = avg(trainScores);
  const restDayAvgScore = avg(restScores);
  if (restDayAvgScore === 0) return null;

  return {
    trainDayAvgScore: Math.round(trainDayAvgScore),
    restDayAvgScore: Math.round(restDayAvgScore),
    pctDiff: (trainDayAvgScore - restDayAvgScore) / restDayAvgScore,
    nightsTrain: trainScores.length,
    nightsRest: restScores.length,
  };
}

// ─────────────────────────────────────────────
// Habit stacking (scoped to one sensible default stack rather than a full
// custom builder, per this session's product call): after a real logged
// workout, nudge hydration + a breathwork moment. Purely a UI suggestion --
// no new table, dismissal is session-local.
// ─────────────────────────────────────────────
export const WELLNESS_TIPS: { emoji: string; text: string }[] = [
  { emoji: '💧', text: 'Dehydration by even 2% can measurably reduce workout performance.' },
  { emoji: '🌬️', text: 'A slow exhale activates your vagus nerve and lowers heart rate within seconds.' },
  { emoji: '📵', text: 'Screens before bed suppress melatonin — try dimming lights an hour before sleep.' },
  { emoji: '🚶', text: 'A short walk after eating can meaningfully blunt post-meal blood sugar spikes.' },
  { emoji: '🧠', text: "Writing down 3 things you're grateful for is linked to better sleep quality." },
  { emoji: '🥶', text: 'Cold exposure for even 30 seconds can boost alertness and mood via norepinephrine.' },
  { emoji: '🎵', text: 'Music without lyrics can improve focus during deep work by reducing verbal interference.' },
];
