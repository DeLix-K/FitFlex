import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import type { MealLog, MealSource, MealType } from './types';

export function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchMealsForDate(logDate: string): Promise<MealLog[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addMeal(params: {
  logDate: string;
  mealType: MealType;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number | null;
  ironMg?: number | null;
  photoUrl?: string | null;
  source: MealSource;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase.from('meal_logs').insert({
    user_id: userId,
    log_date: params.logDate,
    meal_type: params.mealType,
    description: params.description,
    calories: params.calories,
    protein_g: params.proteinG,
    carbs_g: params.carbsG,
    fat_g: params.fatG,
    fiber_g: params.fiberG ?? null,
    iron_mg: params.ironMg ?? null,
    photo_url: params.photoUrl ?? null,
    source: params.source,
  });

  if (error) throw new Error(error.message);
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from('meal_logs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─────────────────────────────────────────────
// Meal photos: uploaded to the same base64 the camera/library picker
// already produces (no re-encode step), into a per-user folder so the
// storage RLS policies in nutrition_overhaul.sql can scope access.
// ─────────────────────────────────────────────
export async function uploadMealPhoto(base64: string, mimeType: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const ext = mimeType.split('/')[1] ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('meal-photos').upload(path, decode(base64), {
    contentType: mimeType,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('meal-photos').getPublicUrl(path);
  return data.publicUrl;
}

// ─────────────────────────────────────────────
// Adaptive Calorie Indicator: real workout minutes logged today (same
// workout_logs table Streaks/My Plans use), converted with the identical
// ACSM MET formula StreaksScreen already uses for "Est. Calories Burned"
// -- duplicated here (not imported) since it's a one-line pure formula and
// this keeps the two features independent, but must stay in sync if that
// formula ever changes.
// ─────────────────────────────────────────────
const MODERATE_WORKOUT_MET = 5.0;
export function estimateWorkoutCalories(minutes: number, weightKg: number): number {
  return Math.round(((MODERATE_WORKOUT_MET * 3.5 * weightKg) / 200) * minutes);
}

export async function fetchTodayWorkoutMinutes(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return 0;

  const { data } = await supabase
    .from('workout_logs')
    .select('duration_minutes')
    .eq('user_id', userId)
    .eq('logged_date', todayLocalDate())
    .maybeSingle();

  return (data as { duration_minutes: number | null } | null)?.duration_minutes ?? 0;
}

// ─────────────────────────────────────────────
// Diet-quality tags: computed only from real numbers already on the meal
// (protein-to-calorie ratio is always real; fiber/iron only ever populated
// from a USDA/barcode source -- see nutrition_overhaul.sql). Never a single
// invented composite "satiety score" -- that would imply a precision this
// app's data doesn't support. No glycemic-index tag either: no real data
// source for it exists in USDA FoodData Central or Open Food Facts.
// ─────────────────────────────────────────────
export function dietQualityTags(meal: Pick<MealLog, 'calories' | 'protein_g' | 'fiber_g' | 'iron_mg'>): string[] {
  const tags: string[] = [];
  if (meal.calories > 0 && (Number(meal.protein_g) * 4) / meal.calories >= 0.3) {
    tags.push('💪 High Protein');
  }
  if (meal.fiber_g != null && Number(meal.fiber_g) >= 5) {
    tags.push('🌾 High Fiber');
  }
  if (meal.iron_mg != null && Number(meal.iron_mg) >= 3) {
    tags.push('🩸 High Iron');
  }
  return tags;
}
