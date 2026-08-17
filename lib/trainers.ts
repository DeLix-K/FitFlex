import { getCheckoutRedirectUrl, openCheckoutUrl } from './checkout';
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

export async function fetchTrainers(): Promise<TrainerProfile[]> {
  const { data, error } = await supabase
    .from('trainer_profiles')
    .select('*')
    .eq('payouts_enabled', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchMyOrdersAsClient(): Promise<TrainerOrderView[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('trainer_order_view')
    .select('*')
    .eq('client_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function buyTrainerPlan(trainerProfileId: string): Promise<void> {
  const returnUrl = getCheckoutRedirectUrl();

  const { url } = await invoke<{ url?: string }>('create-trainer-checkout', {
    trainerProfileId,
    successUrl: returnUrl,
    cancelUrl: returnUrl,
  });

  if (!url) throw new Error('Stripe did not return a checkout URL.');

  await openCheckoutUrl(url);
}
