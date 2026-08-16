import { supabase } from './supabase';
import type { LeaderboardEntry } from './types';

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function hasLoggedToday(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return false;

  const { data } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('logged_date', todayLocalDate())
    .maybeSingle();

  return !!data;
}

export async function logWorkoutToday(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('workout_logs')
    .upsert(
      { user_id: userId, logged_date: todayLocalDate() },
      { onConflict: 'user_id,logged_date', ignoreDuplicates: true }
    );

  if (error) throw new Error(error.message);
}

export async function getMyStats(): Promise<{
  currentStreak: number;
  totalWorkouts: number;
  displayName: string;
}> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { currentStreak: 0, totalWorkouts: 0, displayName: 'Fitness Fan' };

  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    currentStreak: data?.current_streak ?? 0,
    totalWorkouts: data?.total_workouts ?? 0,
    displayName: data?.display_name ?? 'Fitness Fan',
  };
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('current_streak', { ascending: false })
    .order('total_workouts', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateDisplayName(name: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name.trim() })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}
