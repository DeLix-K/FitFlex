import { supabase } from './supabase';
import type { TrainerMessage } from './types';

export async function fetchThread(trainerUserId: string, clientUserId: string): Promise<TrainerMessage[]> {
  const { data, error } = await supabase
    .from('trainer_messages')
    .select('*')
    .eq('trainer_user_id', trainerUserId)
    .eq('client_user_id', clientUserId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function sendMessage(trainerUserId: string, clientUserId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase.from('trainer_messages').insert({
    trainer_user_id: trainerUserId,
    client_user_id: clientUserId,
    sender_id: userId,
    body: trimmed,
  });

  if (error) throw new Error(error.message);
}

export type ClientThread = {
  clientUserId: string;
  clientDisplayName: string;
  lastMessage: string;
  lastAt: string;
};

// Trainer-side inbox: every distinct client who has an open thread with the
// calling trainer, most recently active first. Display names are resolved
// via the public `leaderboard` view (readable by anyone) since `profiles`
// itself is locked to each user's own row.
export async function fetchMyClientThreads(): Promise<ClientThread[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('trainer_messages')
    .select('client_user_id, body, created_at')
    .eq('trainer_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const lastByClient = new Map<string, { lastMessage: string; lastAt: string }>();
  for (const row of data ?? []) {
    if (!lastByClient.has(row.client_user_id)) {
      lastByClient.set(row.client_user_id, { lastMessage: row.body, lastAt: row.created_at });
    }
  }

  const clientIds = Array.from(lastByClient.keys());
  if (clientIds.length === 0) return [];

  const { data: names, error: namesError } = await supabase
    .from('leaderboard')
    .select('user_id, display_name')
    .in('user_id', clientIds);

  if (namesError) throw new Error(namesError.message);

  const nameById = new Map((names ?? []).map((n) => [n.user_id as string, n.display_name as string]));

  return clientIds.map((id) => ({
    clientUserId: id,
    clientDisplayName: nameById.get(id) ?? 'Fitness Fan',
    lastMessage: lastByClient.get(id)!.lastMessage,
    lastAt: lastByClient.get(id)!.lastAt,
  }));
}
