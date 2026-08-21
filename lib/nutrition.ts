import { supabase } from './supabase';
import type { MealLog, MealType } from './types';

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
  source: 'manual' | 'scan' | 'search';
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
    source: params.source,
  });

  if (error) throw new Error(error.message);
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from('meal_logs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
