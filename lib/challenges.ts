import { supabase } from './supabase';
import type { Challenge, ChallengeProgress } from './types';

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getChallengeStatus(
  challenge: Pick<Challenge, 'start_date' | 'end_date'>
): 'active' | 'upcoming' | 'past' {
  const today = todayLocalDate();
  if (today < challenge.start_date) return 'upcoming';
  if (today > challenge.end_date) return 'past';
  return 'active';
}

export async function fetchChallenges(): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchChallengeStats(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('challenge_stats').select('*');
  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.challenge_id] = row.participant_count;
  return counts;
}

export async function fetchMyProgress(): Promise<ChallengeProgress[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('challenge_progress')
    .select('*')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchChallengeLeaderboard(challengeId: string): Promise<ChallengeProgress[]> {
  const { data, error } = await supabase
    .from('challenge_progress')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('workouts_logged', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function joinChallenge(challengeId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('challenge_participants')
    .insert({ challenge_id: challengeId, user_id: userId });

  if (error) throw new Error(error.message);
}

export async function leaveChallenge(challengeId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('challenge_participants')
    .delete()
    .eq('challenge_id', challengeId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}
