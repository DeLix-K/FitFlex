import { getCheckoutRedirectUrl, openCheckoutUrl } from './checkout';
import { supabase } from './supabase';
import type { MerchOrder, MerchProduct } from './types';

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

export async function fetchMerchCatalog(): Promise<MerchProduct[]> {
  const { products } = await invoke<{ products: MerchProduct[] }>('merch-catalog');
  return products ?? [];
}

export async function fetchMyMerchOrders(): Promise<MerchOrder[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('merch_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MerchOrder[];
}

export async function buyMerch(productId: number, syncVariantId: number): Promise<void> {
  const returnUrl = getCheckoutRedirectUrl();

  const { url } = await invoke<{ url?: string }>('create-merch-checkout', {
    productId,
    syncVariantId,
    successUrl: returnUrl,
    cancelUrl: returnUrl,
  });

  if (!url) throw new Error('Stripe did not return a checkout URL.');

  await openCheckoutUrl(url);
}
