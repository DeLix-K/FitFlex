import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';
import type { DigitalProduct, DigitalProductContent, DigitalProductWithStatus } from './types';

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

export async function fetchDigitalProducts(): Promise<DigitalProductWithStatus[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const [productsResult, purchasesResult] = await Promise.all([
    supabase.from('digital_products').select('*').order('created_at', { ascending: true }),
    userId
      ? supabase.from('digital_product_purchases').select('product_id, status').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsResult.error) throw new Error(productsResult.error.message);

  const ownedIds = new Set(
    (purchasesResult.data ?? [])
      .filter((p: { status: string }) => p.status === 'paid')
      .map((p: { product_id: string }) => p.product_id)
  );

  return ((productsResult.data ?? []) as DigitalProduct[]).map((p) => ({
    ...p,
    owned: ownedIds.has(p.id),
  }));
}

export async function fetchDigitalProductContent(productId: string): Promise<DigitalProductContent | null> {
  const { data, error } = await supabase
    .from('digital_product_content')
    .select('*')
    .eq('product_id', productId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function buyDigitalProduct(productId: string): Promise<void> {
  const returnUrl = Platform.OS === 'web' ? window.location.href : undefined;

  const { url } = await invoke<{ url?: string }>('create-digital-product-checkout', {
    productId,
    successUrl: returnUrl,
    cancelUrl: returnUrl,
  });

  if (!url) throw new Error('Stripe did not return a checkout URL.');

  if (Platform.OS === 'web') {
    window.location.href = url;
  } else {
    await Linking.openURL(url);
  }
}
