import { supabase } from './supabase';

export const FREE_DAILY_AI_LIMIT = 5;

export async function getIsPremium(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return false;

  const { data } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', userId)
    .single();

  return data?.is_premium ?? false;
}

export async function getTodayAiUsageCount(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return 0;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('ai_history')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfToday.toISOString());

  return count ?? 0;
}
