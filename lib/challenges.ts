import { supabase } from './supabase';
import type { Challenge, ChallengeInviteView, ChallengeProgress } from './types';

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

export async function createChallenge(params: {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  targetWorkouts: number;
  targetNote: string;
}): Promise<Challenge> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('challenges')
    .insert({
      title: params.title.trim(),
      description: params.description.trim(),
      start_date: params.startDate,
      end_date: params.endDate,
      target_workouts: params.targetWorkouts,
      target_note: params.targetNote.trim(),
      creator_user_id: userId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Creating a challenge doesn't automatically join it, so do that now --
  // it would be strange for the creator not to be a participant.
  await joinChallenge(data.id);

  return data;
}

export type UserSearchResult = { userId: string; displayName: string };

// Search among real FitFlex users (via the public leaderboard view) to
// invite to a challenge -- excludes the caller themself.
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data, error } = await supabase
    .from('leaderboard')
    .select('user_id, display_name')
    .ilike('display_name', `%${trimmed}%`)
    .limit(20);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => row.user_id !== userId)
    .map((row) => ({ userId: row.user_id, displayName: row.display_name }));
}

export async function sendChallengeInvite(challengeId: string, inviteeUserId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase.from('challenge_invites').insert({
    challenge_id: challengeId,
    inviter_user_id: userId,
    invitee_user_id: inviteeUserId,
  });

  if (error) throw new Error(error.message);
}

export async function fetchMyChallengeInvites(): Promise<ChallengeInviteView[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('challenge_invites')
    .select('*, challenges(title)')
    .eq('invitee_user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as (ChallengeInviteView & {
    challenges: { title: string } | null;
  })[];

  const inviterIds = Array.from(new Set(rows.map((r) => r.inviter_user_id)));
  let namesById = new Map<string, string>();
  if (inviterIds.length > 0) {
    const { data: names } = await supabase
      .from('leaderboard')
      .select('user_id, display_name')
      .in('user_id', inviterIds);
    namesById = new Map((names ?? []).map((n) => [n.user_id as string, n.display_name as string]));
  }

  return rows.map((r) => ({
    ...r,
    challenge_title: r.challenges?.title ?? 'a challenge',
    inviter_display_name: namesById.get(r.inviter_user_id) ?? 'A FitFlex user',
  }));
}

export async function respondToChallengeInvite(inviteId: string, accept: boolean, challengeId: string): Promise<void> {
  const { error } = await supabase
    .from('challenge_invites')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', inviteId);

  if (error) throw new Error(error.message);

  if (accept) await joinChallenge(challengeId);
}
