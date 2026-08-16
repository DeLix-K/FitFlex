// Supabase Edge Function: lets a trainer deliver a custom workout plan for
// a paid order. Creates the plan under the CLIENT's user_id (not the
// trainer's) via the service role, since normal RLS only lets a user create
// plans for themselves — this is the one trusted path around that, gated on
// the caller actually being the trainer for a 'paid' order.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PlanItem = {
  exerciseId: string;
  sets?: number | null;
  reps?: number | null;
  notes?: string | null;
};

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

    const { orderId, planName, planDescription, items } = await req.json().catch(() => ({}));
    if (!orderId || !planName || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing orderId, planName, or items.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const itemsValid = (items as unknown[]).every(
      (item) => typeof (item as { exerciseId?: unknown }).exerciseId === 'string' &&
        UUID_RE.test((item as { exerciseId: string }).exerciseId)
    );
    if (!itemsValid) {
      return new Response(
        JSON.stringify({ error: 'Every item must have a valid exerciseId.' }),
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

    const { data: order, error: orderError } = await adminClient
      .from('trainer_orders')
      .select('id, client_user_id, trainer_user_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (order.trainer_user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'This order does not belong to you.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (order.status !== 'paid') {
      return new Response(
        JSON.stringify({ error: `Order is not ready to fulfill (status: ${order.status}).` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: plan, error: planError } = await adminClient
      .from('workout_plans')
      .insert({
        user_id: order.client_user_id,
        name: String(planName).trim(),
        description: planDescription ? String(planDescription).trim() : '',
      })
      .select()
      .single();

    if (planError) {
      return new Response(JSON.stringify({ error: `Could not create plan: ${planError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rows = (items as PlanItem[]).map((item, index) => ({
      workout_plan_id: plan.id,
      exercise_id: item.exerciseId,
      order_index: index,
      sets: item.sets ?? null,
      reps: item.reps ?? null,
      notes: item.notes ?? '',
    }));

    const { error: itemsError } = await adminClient.from('workout_plan_exercises').insert(rows);

    if (itemsError) {
      // Roll back the plan so a failed delivery doesn't leave an empty plan
      // sitting in the client's account.
      await adminClient.from('workout_plans').delete().eq('id', plan.id);
      return new Response(
        JSON.stringify({ error: `Could not add exercises: ${itemsError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateError } = await adminClient
      .from('trainer_orders')
      .update({ status: 'fulfilled', workout_plan_id: plan.id, fulfilled_at: new Date().toISOString() })
      .eq('id', order.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Plan delivered but order update failed: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: true, planId: plan.id }), {
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
