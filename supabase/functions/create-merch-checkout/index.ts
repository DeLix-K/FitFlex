// Supabase Edge Function: creates a Stripe Checkout session for a merch
// purchase, with Stripe's native shipping-address collection. Paid directly
// to the platform (no Stripe Connect). Re-fetches the real price from
// Printful server-side rather than trusting anything the client sends.
// Deploy via the Supabase dashboard: Edge Functions > Create a new function.
// Keep "Enforce JWT Verification" ON.

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function buildCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
}

function safeRedirect(url: string | undefined, origin: string | null): string {
  if (url) {
    try {
      if (isAllowedOrigin(new URL(url).origin)) return url;
    } catch {
      // fall through to the default below
    }
  }
  return origin ?? 'https://example.com';
}

const ALLOWED_SHIPPING_COUNTRIES = ['US', 'GB', 'CA', 'AU'] as const;

function printfulHeaders(): Record<string, string> {
  const token = Deno.env.get('PRINTFUL_API_TOKEN')!;
  const storeId = Deno.env.get('PRINTFUL_STORE_ID');
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (storeId) headers['X-PF-Store-Id'] = storeId;
  return headers;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { productId, syncVariantId, successUrl, cancelUrl } = await req.json().catch(() => ({}));
    if (!productId || !syncVariantId) {
      return new Response(JSON.stringify({ error: 'Missing productId or syncVariantId.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const printfulToken = Deno.env.get('PRINTFUL_API_TOKEN');
    if (!printfulToken) {
      return new Response(JSON.stringify({ error: 'Printful is not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const detailResponse = await fetch(`https://api.printful.com/store/products/${encodeURIComponent(String(productId))}`, {
      headers: printfulHeaders(),
    });
    if (!detailResponse.ok) {
      return new Response(JSON.stringify({ error: 'Product not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const detailData = await detailResponse.json();
    const productName = detailData.result?.sync_product?.name as string | undefined;
    const variant = (detailData.result?.sync_variants ?? []).find(
      (v: { id: number }) => v.id === syncVariantId
    );

    if (!variant || variant.availability_status !== 'active') {
      return new Response(JSON.stringify({ error: 'This item is not available right now.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceCents = Math.round(parseFloat(variant.retail_price) * 100);
    const itemName = `${productName ?? 'FitFlex Merch'} — ${variant.name}`;

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Stripe is not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      shipping_address_collection: { allowed_countries: [...ALLOWED_SHIPPING_COUNTRIES] },
      line_items: [
        {
          price_data: {
            currency: (variant.currency ?? 'usd').toLowerCase(),
            unit_amount: priceCents,
            product_data: { name: itemName },
          },
          quantity: 1,
        },
      ],
      success_url: safeRedirect(successUrl, req.headers.get('Origin')),
      cancel_url: safeRedirect(cancelUrl ?? successUrl, req.headers.get('Origin')),
      metadata: {
        fitflex_order_type: 'merch',
        supabase_user_id: user.id,
      },
    });

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: insertError } = await adminClient.from('merch_orders').insert({
      user_id: user.id,
      status: 'pending_payment',
      stripe_checkout_session_id: session.id,
      items: [
        {
          syncVariantId: variant.id,
          name: itemName,
          size: variant.size,
          color: variant.color,
          quantity: 1,
          priceCents,
        },
      ],
      amount_cents: priceCents,
    });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: `Could not record order: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
