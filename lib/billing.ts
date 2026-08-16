import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';

export async function startCheckout(): Promise<void> {
  const returnUrl = Platform.OS === 'web' ? window.location.href : undefined;

  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    'create-checkout-session',
    { body: { successUrl: returnUrl, cancelUrl: returnUrl } }
  );

  if (error) {
    const context = (error as { context?: Response }).context;
    let detailedMessage: string | undefined;
    if (context) {
      try {
        const body = await context.clone().json();
        if (body?.error) detailedMessage = body.error;
      } catch {
        // fall through
      }
    }
    throw new Error(detailedMessage ?? error.message);
  }

  if (data?.error) throw new Error(data.error);
  if (!data?.url) throw new Error('Stripe did not return a checkout URL.');

  if (Platform.OS === 'web') {
    window.location.href = data.url;
  } else {
    await Linking.openURL(data.url);
  }
}
