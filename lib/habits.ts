import { supabase } from './supabase';
import type { HabitWithStatus } from './types';

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchHabits(): Promise<HabitWithStatus[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const today = todayLocalDate();

  const [habitsResult, streaksResult, todayLogsResult] = await Promise.all([
    supabase.from('habits').select('*').order('created_at', { ascending: true }),
    supabase.from('habit_streaks').select('*'),
    supabase.from('habit_logs').select('habit_id').eq('user_id', userId).eq('logged_date', today),
  ]);

  if (habitsResult.error) throw new Error(habitsResult.error.message);
  if (streaksResult.error) throw new Error(streaksResult.error.message);
  if (todayLogsResult.error) throw new Error(todayLogsResult.error.message);

  const streakByHabit = new Map<string, number>();
  for (const row of streaksResult.data ?? []) streakByHabit.set(row.habit_id, row.current_streak);

  const doneToday = new Set((todayLogsResult.data ?? []).map((row) => row.habit_id));

  return (habitsResult.data ?? []).map((habit) => ({
    ...habit,
    current_streak: streakByHabit.get(habit.id) ?? 0,
    done_today: doneToday.has(habit.id),
  }));
}

export async function createHabit(name: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase.from('habits').insert({ user_id: userId, name: name.trim() });
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
