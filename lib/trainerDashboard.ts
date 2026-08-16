import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';
import type { TrainerOrderView, TrainerProfile } from './types';

async function invoke<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(name, {
    body: body ?? {},
  });

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
  return data as T;
}

export async function fetchMyTrainerProfile(): Promise<TrainerProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('trainer_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchMyOrdersAsTrainer(): Promise<TrainerOrderView[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('trainer_order_view')
    .select('*')
    .eq('trainer_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function startTrainerOnboarding(): Promise<{ payoutsEnabled: boolean }> {
  const returnUrl = Platform.OS === 'web' ? window.location.href : undefined;

  const { url, payoutsEnabled } = await invoke<{ url?: string; payoutsEnabled: boolean }>(
    'trainer-connect-onboarding',
    { returnUrl }
  );

  if (!url) throw new Error('Stripe did not return an onboarding URL.');

  if (!payoutsEnabled) {
    if (Platform.OS === 'web') {
      window.location.href = url;
    } else {
      await Linking.openURL(url);
    }
  }

  return { payoutsEnabled };
}

export async function deliverPlan(params: {
  orderId: string;
  planName: string;
  planDescription: string;
  items: { exerciseId: string; sets: number | null; reps: number | null; notes: string }[];
}): Promise<void> {
  await invoke('trainer-deliver-plan', params);
}
