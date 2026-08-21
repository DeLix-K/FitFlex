import { supabase } from './supabase';

export type OuraData =
  | { connected: false; error?: string }
  | {
      connected: true;
      steps: number;
      calories: number;
      distance: number;
      activeMinutes: number;
      recoveryScore: number | null;
      hrvBalance: number | null;
      error?: string;
    };

async function invokeOuraFunction<T>(name: string, body?: Record<string, unknown>): Promise<T> {
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

  if (data?.error && !('connected' in (data as object))) {
    throw new Error(data.error);
  }

  return data as T;
}

export function getOuraAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.EXPO_PUBLIC_OURA_CLIENT_ID;
  if (!clientId) throw new Error('EXPO_PUBLIC_OURA_CLIENT_ID is not set.');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'daily',
    state,
  });

  return `https://cloud.ouraring.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeOuraCode(code: string, redirectUri: string): Promise<void> {
  await invokeOuraFunction('oura-callback', { code, redirectUri });
}

export async function getOuraData(): Promise<OuraData> {
  return invokeOuraFunction<OuraData>('oura-data');
}

export async function disconnectOura(): Promise<void> {
  await invokeOuraFunction('oura-disconnect');
}
