// Supabase Edge Function: returns the caller's Oura connection status and,
// if connected, today's activity summary. Refreshes the access token first
// if it has expired. OURA_CLIENT_SECRET stays server-side.
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

async function refreshOuraToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!response.ok) return null;
  return response.json();
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

    const { data: connection } = await adminClient
      .from('oura_connections')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!connection) {
      return new Response(JSON.stringify({ connected: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let accessToken = connection.access_token;

    if (new Date(connection.expires_at).getTime() <= Date.now()) {
      const clientId = Deno.env.get('OURA_CLIENT_ID');
      const clientSecret = Deno.env.get('OURA_CLIENT_SECRET');
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: 'Oura is not configured.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const refreshed = await refreshOuraToken(connection.refresh_token, clientId, clientSecret);
      if (!refreshed) {
        // Refresh token is likely revoked/expired — the user needs to reconnect.
        await adminClient.from('oura_connections').delete().eq('user_id', user.id);
        return new Response(
          JSON.stringify({ connected: false, error: 'Oura connection expired. Please reconnect.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      accessToken = refreshed.access_token;
      await adminClient
        .from('oura_connections')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq('user_id', user.id);
    }

    const today = new Date().toISOString().slice(0, 10);
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    // Readiness gives us a genuine recovery score + HRV balance sub-score --
    // fetched alongside activity rather than fabricating these numbers.
    // Failure here isn't fatal: readiness can be missing for a given day
    // (e.g. a new ring) even when activity data exists.
    const [summaryResponse, readinessResponse] = await Promise.all([
      fetch(
        `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${today}&end_date=${today}`,
        { headers: authHeaders }
      ),
      fetch(
        `https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${today}&end_date=${today}`,
        { headers: authHeaders }
      ),
    ]);

    if (!summaryResponse.ok) {
      const errorBody = await summaryResponse.text();
      console.error('Oura API error', summaryResponse.status, errorBody);
      return new Response(
        JSON.stringify({ connected: true, error: 'Could not load Oura data. Please try again.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const readinessRecord = readinessResponse.ok
      ? (await readinessResponse.json()).data?.[0]
      : undefined;

    const summaryData = await summaryResponse.json();
    const record = summaryData.data?.[0];

    if (!record) {
      return new Response(
        JSON.stringify({
          connected: true,
          steps: 0,
          calories: 0,
          distance: 0,
          activeMinutes: 0,
          recoveryScore: readinessRecord?.score ?? null,
          hrvBalance: readinessRecord?.contributors?.hrv_balance ?? null,
          restingHeartRateBalance: readinessRecord?.contributors?.resting_heart_rate ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const activeSeconds =
      (record.high_activity_time ?? 0) +
      (record.medium_activity_time ?? 0) +
      (record.low_activity_time ?? 0);

    return new Response(
      JSON.stringify({
        connected: true,
        steps: record.steps ?? 0,
        calories: record.total_calories ?? 0,
        distance: Math.round(((record.equivalent_walking_distance ?? 0) / 1000) * 10) / 10,
        activeMinutes: Math.round(activeSeconds / 60),
        recoveryScore: readinessRecord?.score ?? null,
        hrvBalance: readinessRecord?.contributors?.hrv_balance ?? null,
        restingHeartRateBalance: readinessRecord?.contributors?.resting_heart_rate ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
