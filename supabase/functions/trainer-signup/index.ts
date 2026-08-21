// Supabase Edge Function: lets any signed-in user become a trainer and
// create/edit their own trainer_profiles listing. This is the one trusted,
// audited path that flips profiles.is_trainer (normally an immutable,
// admin-only flag, same pattern as is_admin/is_premium) -- the client can
// never set that column directly. payouts_enabled and stripe_account_id
// stay untouched here; those are only ever set by trainer-connect-onboarding
// after real Stripe verification, so a new trainer's listing does not show
// up as bookable (fetchTrainers filters payouts_enabled = true) until they
// actually complete payout setup.
// Deploy via the Supabase dashboard: Edge Functions > Create a new function.
// Keep "Enforce JWT Verification" ON.

import { createClient } from 'npm:@supabase/supabase-js@2';

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

    const { displayName, bio, specialty, priceCents } = await req.json().catch(() => ({}));

    const trimmedName = typeof displayName === 'string' ? displayName.trim() : '';
    const trimmedBio = typeof bio === 'string' ? bio.trim() : '';
    const trimmedSpecialty = typeof specialty === 'string' ? specialty.trim() : '';
    const price = Number(priceCents);

    if (!trimmedName || trimmedName.length > 80) {
      return new Response(JSON.stringify({ error: 'Enter a display name (up to 80 characters).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (trimmedBio.length > 2000) {
      return new Response(JSON.stringify({ error: 'Bio is too long (max 2000 characters).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!Number.isInteger(price) || price < 100 || price > 100000) {
      return new Response(
        JSON.stringify({ error: 'Price must be between $1 and $1,000.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ is_trainer: true })
      .eq('id', user.id);

    if (profileError) {
      return new Response(JSON.stringify({ error: `Could not enable trainer access: ${profileError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: upsertError } = await adminClient
      .from('trainer_profiles')
      .upsert(
        {
          user_id: user.id,
          display_name: trimmedName,
          bio: trimmedBio,
          specialty: trimmedSpecialty,
          price_cents: price,
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      return new Response(JSON.stringify({ error: `Could not save trainer profile: ${upsertError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
