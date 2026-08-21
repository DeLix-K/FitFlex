import { supabase } from './supabase';
import type { ActivityLevel, BodyStats, Goal, Sex } from './types';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

export async function fetchBodyStats(): Promise<BodyStats | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('height_cm, weight_kg, age, sex, activity_level, goal')
    .eq('id', userId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateBodyStats(stats: BodyStats): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase.from('profiles').update(stats).eq('id', userId);
  if (error) throw new Error(error.message);
}

// Mifflin-St Jeor equation — the standard formula for estimating resting
// calorie needs from height/weight/age/sex, then scaled by activity level
// and nudged by goal. Requires more than just height (despite the roadmap
// doc only mentioning height) since no BMR formula is accurate without age
// and sex too.
export function computeTargets(
  stats: BodyStats
): { calories: number; proteinGrams: number; carbGrams: number; fatGrams: number } | null {
  const { height_cm, weight_kg, age, sex, activity_level, goal } = stats;
  if (!height_cm || !weight_kg || !age || !sex || !activity_level || !goal) return null;

  const bmr =
    sex === 'male'
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
      : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;

  const tdee = bmr * ACTIVITY_MULTIPLIERS[activity_level];
  const calories = Math.round(tdee + GOAL_ADJUSTMENT[goal]);
  const proteinGrams = Math.round(weight_kg * 1.8);

  // Fat gets a standard 25% of total calories; carbs fill the remainder
  // after protein and fat. Both are derived from the same calorie target,
  // not independently invented numbers.
  const fatGrams = Math.round((calories * 0.25) / 9);
  const remainingCalories = Math.max(0, calories - proteinGrams * 4 - fatGrams * 9);
  const carbGrams = Math.round(remainingCalories / 4);

  return { calories, proteinGrams, carbGrams, fatGrams };
}

export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string }>(
    'delete-account',
    { body: {} }
  );

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

  if (data?.error) throw new Error(data.error);

  await supabase.auth.signOut();
}

export type { ActivityLevel, Goal, Sex };
