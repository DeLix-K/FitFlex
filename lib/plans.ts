import { primaryMuscle, findSubstitutes } from './exercises';
import { supabase } from './supabase';
import type {
  Exercise,
  PlanScheduleEntry,
  PlanThemeKey,
  Program,
  ProgramPlanEntry,
  ProgramScheduleMode,
  WorkoutLog,
  WorkoutPlan,
  WorkoutPlanExercise,
} from './types';

function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('Not signed in.');
  return userId;
}

// ─────────────────────────────────────────────
// Theme palettes: purely cosmetic customization ("Dynamic Card Themes" from
// the spec). A small hand-picked set, not a generative/AI theme -- same
// honesty bar as everything else here.
// ─────────────────────────────────────────────
export const PLAN_THEMES: Record<PlanThemeKey, { label: string; accent: string; accentDark: string; surface: string }> = {
  neon: { label: 'Neon', accent: '#a3e635', accentDark: '#65a30d', surface: '#161f0f' },
  charcoal: { label: 'Charcoal Minimal', accent: '#d4d4d8', accentDark: '#71717a', surface: '#1c1c1e' },
  gold: { label: 'Gold / Champion', accent: '#fbbf24', accentDark: '#b45309', surface: '#241c0d' },
  crimson: { label: 'Crimson', accent: '#f87171', accentDark: '#b91c1c', surface: '#240f0f' },
  azure: { label: 'Azure', accent: '#38bdf8', accentDark: '#0369a1', surface: '#0d1c24' },
};
export const PLAN_EMOJI_OPTIONS = ['💪', '🔥', '⚡', '🏋️', '🏃', '🧘', '✈️', '🏆', '🎯', '⏱️'];

// ─────────────────────────────────────────────
// Monetization: Programs (the structured multi-plan rotation + real
// progress tracking) is the premium anchor for this tab -- standalone
// plans, starter templates, and sharing all stay free (acquisition/
// retention/growth levers, not revenue levers). Smart Swap All and the
// gold/crimson/azure themes are bundled Premium perks. Gated the same way
// as everywhere else in the app: `profiles.is_premium` -> Stripe checkout,
// never a client-only flag.
// ─────────────────────────────────────────────
export const FREE_PROGRAM_LIMIT = 1;
export const FREE_THEME_KEYS: PlanThemeKey[] = ['neon', 'charcoal'];

export function canCreateProgram(isPremium: boolean, currentProgramCount: number): boolean {
  return isPremium || currentProgramCount < FREE_PROGRAM_LIMIT;
}

// ─────────────────────────────────────────────
// Plans (unchanged data, richer selects)
// ─────────────────────────────────────────────
export async function fetchPlans(): Promise<WorkoutPlan[]> {
  const { data, error } = await supabase.from('workout_plans').select('*').order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchSchedule(): Promise<PlanScheduleEntry[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase.from('plan_schedule').select('*').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function assignWeekday(weekday: number, planId: string | null): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from('plan_schedule')
    .upsert({ user_id: userId, weekday, plan_id: planId }, { onConflict: 'user_id,weekday' });
  if (error) throw new Error(error.message);
}

export async function createPlan(params: {
  name: string;
  description?: string;
  themeKey?: PlanThemeKey;
  emoji?: string | null;
}): Promise<WorkoutPlan> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('workout_plans')
    .insert({
      user_id: userId,
      name: params.name,
      description: params.description ?? '',
      theme_key: params.themeKey ?? 'neon',
      emoji: params.emoji ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePlanStyle(
  planId: string,
  patch: { themeKey?: PlanThemeKey; emoji?: string | null }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.themeKey !== undefined) update.theme_key = patch.themeKey;
  if (patch.emoji !== undefined) update.emoji = patch.emoji;
  const { error } = await supabase.from('workout_plans').update(update).eq('id', planId);
  if (error) throw new Error(error.message);
}

// ─────────────────────────────────────────────
// Programs: optional grouping of existing plans into a rotation.
// ─────────────────────────────────────────────
export async function fetchPrograms(): Promise<Program[]> {
  const { data, error } = await supabase.from('programs').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAllProgramPlans(): Promise<ProgramPlanEntry[]> {
  const { data, error } = await supabase.from('program_plans').select('*').order('order_index', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createProgram(params: {
  name: string;
  description?: string;
  themeKey?: PlanThemeKey;
  emoji?: string | null;
  durationWeeks?: number | null;
  startDate?: string | null;
  deloadIntervalWeeks?: number | null;
  scheduleMode: ProgramScheduleMode;
}): Promise<Program> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('programs')
    .insert({
      user_id: userId,
      name: params.name,
      description: params.description ?? '',
      theme_key: params.themeKey ?? 'neon',
      emoji: params.emoji ?? null,
      duration_weeks: params.durationWeeks ?? null,
      start_date: params.startDate ?? todayLocalDate(),
      deload_interval_weeks: params.deloadIntervalWeeks ?? null,
      schedule_mode: params.scheduleMode,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProgram(
  programId: string,
  patch: Partial<{
    name: string;
    description: string;
    themeKey: PlanThemeKey;
    emoji: string | null;
    durationWeeks: number | null;
    startDate: string | null;
    deloadIntervalWeeks: number | null;
    scheduleMode: ProgramScheduleMode;
  }>
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.themeKey !== undefined) update.theme_key = patch.themeKey;
  if (patch.emoji !== undefined) update.emoji = patch.emoji;
  if (patch.durationWeeks !== undefined) update.duration_weeks = patch.durationWeeks;
  if (patch.startDate !== undefined) update.start_date = patch.startDate;
  if (patch.deloadIntervalWeeks !== undefined) update.deload_interval_weeks = patch.deloadIntervalWeeks;
  if (patch.scheduleMode !== undefined) update.schedule_mode = patch.scheduleMode;
  const { error } = await supabase.from('programs').update(update).eq('id', programId);
  if (error) throw new Error(error.message);
}

export async function deleteProgram(programId: string): Promise<void> {
  const { error } = await supabase.from('programs').delete().eq('id', programId);
  if (error) throw new Error(error.message);
}

export async function addPlanToProgram(
  programId: string,
  planId: string,
  opts: { weekday?: number | null; orderIndex?: number } = {}
): Promise<ProgramPlanEntry> {
  const { data, error } = await supabase
    .from('program_plans')
    .insert({
      program_id: programId,
      plan_id: planId,
      weekday: opts.weekday ?? null,
      order_index: opts.orderIndex ?? 0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removePlanFromProgram(programPlanId: string): Promise<void> {
  const { error } = await supabase.from('program_plans').delete().eq('id', programPlanId);
  if (error) throw new Error(error.message);
}

export async function setProgramPlanWeekday(programPlanId: string, weekday: number | null): Promise<void> {
  const { error } = await supabase.from('program_plans').update({ weekday }).eq('id', programPlanId);
  if (error) throw new Error(error.message);
}

// ─────────────────────────────────────────────
// Progress: computed entirely from real dates and real workout_logs rows,
// never fabricated. `loggedDates` = every date (YYYY-MM-DD) the user has
// ANY workout_logs row (same signal the Streaks tab already trusts).
// ─────────────────────────────────────────────
function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // week starts Monday
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type WeekdayProgress = {
  weekNumber: number | null;
  totalWeeks: number | null;
  isDeloadWeek: boolean;
  thisWeekScheduled: number;
  thisWeekDone: number;
};

export function computeWeekdayProgress(
  program: Program,
  entries: ProgramPlanEntry[],
  loggedDates: Set<string>
): WeekdayProgress {
  const weekdaysWithSessions = new Set(entries.filter((e) => e.weekday != null).map((e) => e.weekday as number));
  const weekStart = startOfWeek(new Date());
  let thisWeekDone = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    if (weekdaysWithSessions.has(d.getDay()) && loggedDates.has(toDateStr(d))) thisWeekDone++;
  }

  if (!program.start_date) {
    return {
      weekNumber: null,
      totalWeeks: program.duration_weeks,
      isDeloadWeek: false,
      thisWeekScheduled: weekdaysWithSessions.size,
      thisWeekDone,
    };
  }

  const start = new Date(program.start_date + 'T00:00:00');
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weekNumber = Math.max(1, Math.floor((startOfWeek(new Date()).getTime() - startOfWeek(start).getTime()) / msPerWeek) + 1);
  const isDeloadWeek = !!program.deload_interval_weeks && weekNumber % program.deload_interval_weeks === 0;

  return {
    weekNumber,
    totalWeeks: program.duration_weeks,
    isDeloadWeek,
    thisWeekScheduled: weekdaysWithSessions.size,
    thisWeekDone,
  };
}

export type FlexibleProgress = {
  completedSessions: number;
  totalSessions: number;
  nextEntry: ProgramPlanEntry | null;
  cycleNumber: number;
};

export function computeFlexibleProgress(entries: ProgramPlanEntry[], completedSessionsForProgram: number): FlexibleProgress {
  const ordered = [...entries].sort((a, b) => a.order_index - b.order_index);
  const totalSessions = ordered.length;
  if (totalSessions === 0) {
    return { completedSessions: completedSessionsForProgram, totalSessions: 0, nextEntry: null, cycleNumber: 1 };
  }
  const nextIndex = completedSessionsForProgram % totalSessions;
  const cycleNumber = Math.floor(completedSessionsForProgram / totalSessions) + 1;
  return {
    completedSessions: completedSessionsForProgram,
    totalSessions,
    nextEntry: ordered[nextIndex],
    cycleNumber,
  };
}

// ─────────────────────────────────────────────
// Finishing a session: a real completion, tied to the specific plan/program
// it was for. Reuses the same workout_logs row the Streaks tab's generic
// "Log Workout" already writes (one row per calendar day) -- if that row
// already exists for today, this enriches it with plan/program/duration
// instead of silently ignoring the conflict.
// ─────────────────────────────────────────────
export async function finishSession(params: {
  planId: string | null;
  programId: string | null;
  durationMinutes?: number | null;
}): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase.from('workout_logs').upsert(
    {
      user_id: userId,
      logged_date: todayLocalDate(),
      workout_plan_id: params.planId,
      program_id: params.programId,
      duration_minutes: params.durationMinutes ?? null,
    },
    { onConflict: 'user_id,logged_date' }
  );
  if (error) throw new Error(error.message);
}

export async function fetchWorkoutLogsInRange(startDate: string, endDate: string): Promise<WorkoutLog[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_date', startDate)
    .lte('logged_date', endDate);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function countCompletedSessionsForProgram(programId: string): Promise<number> {
  const userId = await currentUserId();
  const { count, error } = await supabase
    .from('workout_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('program_id', programId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ─────────────────────────────────────────────
// Body focus: real tally of primary muscles across a plan's actual
// exercises -- no invented percentages.
// ─────────────────────────────────────────────
export function computeBodyFocus(items: WorkoutPlanExercise[]): { muscle: string; count: number; pct: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const primary = item.exercises.muscle_groups?.[0];
    if (!primary) continue;
    counts.set(primary, (counts.get(primary) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return [...counts.entries()]
    .map(([muscle, count]) => ({ muscle, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

// ─────────────────────────────────────────────
// Smart Swap All: real substitution reuse (lib/exercises.ts findSubstitutes),
// applied across every exercise in a plan at once. Exercises that already
// match the target equipment, or that have no valid substitute in the real
// catalog, are left untouched and reported back -- never silently faked.
// ─────────────────────────────────────────────
export async function smartSwapEquipment(
  items: WorkoutPlanExercise[],
  targetEquipment: string,
  allExercises: Exercise[]
): Promise<{ swapped: { itemId: string; from: string; to: string }[]; unchanged: string[] }> {
  const swapped: { itemId: string; from: string; to: string }[] = [];
  const unchanged: string[] = [];
  const exerciseById = new Map(allExercises.map((e) => [e.id, e]));

  for (const item of items) {
    const exercise = exerciseById.get(item.exercise_id);
    if (!exercise) continue;
    const alreadyMatches =
      targetEquipment === 'bodyweight' ? exercise.equipment.length === 0 : exercise.equipment.includes(targetEquipment);
    if (alreadyMatches) continue;

    const candidates = findSubstitutes(exercise, allExercises, { equipment: targetEquipment });
    if (candidates.length === 0) {
      unchanged.push(exercise.name);
      continue;
    }
    const replacement = candidates[0];
    const { error } = await supabase
      .from('workout_plan_exercises')
      .update({ exercise_id: replacement.id })
      .eq('id', item.id);
    if (error) throw new Error(error.message);
    swapped.push({ itemId: item.id, from: exercise.name, to: replacement.name });
  }

  return { swapped, unchanged };
}

// ─────────────────────────────────────────────
// Starter templates: hand-authored by us using the real exercise catalog,
// explicitly labeled "Starter Templates" -- never presented as community or
// trainer-submitted content, since no real shared content exists yet.
// ─────────────────────────────────────────────
type TemplateExercise = { name: string; sets: number; reps: number; notes?: string };
type TemplateDay = { dayName: string; exercises: TemplateExercise[] };
export type StarterTemplate = {
  key: string;
  title: string;
  summary: string;
  category: 'gym' | 'home';
  scheduleMode: ProgramScheduleMode;
  days: TemplateDay[];
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: 'ppl',
    title: 'Push / Pull / Legs',
    summary: '3-day gym split, rotates session by session -- great if your days off aren’t fixed.',
    category: 'gym',
    scheduleMode: 'flexible',
    days: [
      {
        dayName: 'Push Day',
        exercises: [
          { name: 'Barbell bench press', sets: 4, reps: 8 },
          { name: 'Overhead barbell press', sets: 3, reps: 10 },
          { name: 'Incline dumbbell press', sets: 3, reps: 10 },
          { name: 'Lateral raises', sets: 3, reps: 15 },
          { name: 'Tricep pushdown', sets: 3, reps: 12 },
        ],
      },
      {
        dayName: 'Pull Day',
        exercises: [
          { name: 'Deadlift', sets: 3, reps: 5 },
          { name: 'Lat pulldown', sets: 4, reps: 10 },
          { name: 'Seated cable row', sets: 3, reps: 10 },
          { name: 'Barbell curl', sets: 3, reps: 10 },
          { name: 'Face pulls', sets: 3, reps: 15 },
        ],
      },
      {
        dayName: 'Leg Day',
        exercises: [
          { name: 'Barbell back squat', sets: 4, reps: 8 },
          { name: 'Romanian deadlift', sets: 3, reps: 10 },
          { name: 'Leg press', sets: 3, reps: 12 },
          { name: 'Leg curl', sets: 3, reps: 12 },
          { name: 'Standing calf raise', sets: 4, reps: 15 },
        ],
      },
    ],
  },
  {
    key: 'upper_lower',
    title: 'Upper / Lower',
    summary: '2-day gym split alternating upper and lower body -- flexible session rotation.',
    category: 'gym',
    scheduleMode: 'flexible',
    days: [
      {
        dayName: 'Upper Day',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: 8 },
          { name: 'Barbell bent-over row', sets: 4, reps: 8 },
          { name: 'Overhead barbell press', sets: 3, reps: 10 },
          { name: 'Lat pulldown', sets: 3, reps: 10 },
          { name: 'Barbell curl', sets: 3, reps: 12 },
          { name: 'Tricep pushdown', sets: 3, reps: 12 },
        ],
      },
      {
        dayName: 'Lower Day',
        exercises: [
          { name: 'Barbell back squat', sets: 4, reps: 8 },
          { name: 'Romanian deadlift', sets: 3, reps: 10 },
          { name: 'Leg press', sets: 3, reps: 12 },
          { name: 'Leg curl', sets: 3, reps: 12 },
          { name: 'Standing calf raise', sets: 4, reps: 15 },
          { name: 'Plank', sets: 3, reps: 1, notes: '30-45 second hold each set' },
        ],
      },
    ],
  },
  {
    key: 'full_body',
    title: 'Full Body',
    summary: 'One balanced session, ideal to repeat 3x/week with a rest day between.',
    category: 'gym',
    scheduleMode: 'flexible',
    days: [
      {
        dayName: 'Full Body',
        exercises: [
          { name: 'Barbell back squat', sets: 3, reps: 8 },
          { name: 'Bench Press', sets: 3, reps: 8 },
          { name: 'Barbell bent-over row', sets: 3, reps: 8 },
          { name: 'Overhead barbell press', sets: 3, reps: 10 },
          { name: 'Romanian deadlift', sets: 3, reps: 10 },
          { name: 'Plank', sets: 3, reps: 1, notes: '30-45 second hold each set' },
        ],
      },
    ],
  },
  {
    key: 'bodyweight',
    title: 'Bodyweight / No Equipment',
    summary: 'A full session with zero equipment -- for travel, hotel rooms, or home.',
    category: 'home',
    scheduleMode: 'flexible',
    days: [
      {
        dayName: 'Bodyweight Session',
        exercises: [
          { name: 'Push-ups', sets: 3, reps: 15 },
          { name: 'Bodyweight squats', sets: 3, reps: 20 },
          { name: 'Superman', sets: 3, reps: 12 },
          { name: 'Plank', sets: 3, reps: 1, notes: '30-45 second hold each set' },
          { name: 'Lunges', sets: 3, reps: 12 },
          { name: 'Chair dips', sets: 3, reps: 12 },
        ],
      },
    ],
  },
];

export async function applyStarterTemplate(
  template: StarterTemplate,
  allExercises: Exercise[]
): Promise<{ program: Program | null; plans: WorkoutPlan[]; missing: string[] }> {
  const exerciseByName = new Map(allExercises.map((e) => [e.name, e]));
  const missing: string[] = [];
  const plans: WorkoutPlan[] = [];

  for (const day of template.days) {
    const plan = await createPlan({
      name: day.dayName,
      description: `From the "${template.title}" starter template.`,
      themeKey: 'neon',
      emoji: template.category === 'home' ? '🏠' : '🏋️',
    });
    plans.push(plan);

    let orderIndex = 0;
    for (const te of day.exercises) {
      const exercise = exerciseByName.get(te.name);
      if (!exercise) {
        missing.push(te.name);
        continue;
      }
      const { error } = await supabase.from('workout_plan_exercises').insert({
        workout_plan_id: plan.id,
        exercise_id: exercise.id,
        order_index: orderIndex++,
        sets: te.sets,
        reps: te.reps,
        notes: te.notes ?? null,
      });
      if (error) throw new Error(error.message);
    }
  }

  let program: Program | null = null;
  if (plans.length > 1) {
    program = await createProgram({
      name: template.title,
      description: template.summary,
      scheduleMode: template.scheduleMode,
    });
    let orderIndex = 0;
    for (const plan of plans) {
      await addPlanToProgram(program.id, plan.id, { orderIndex: orderIndex++ });
    }
  }

  return { program, plans, missing };
}
